// @refresh reset
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runWithRetry } from "@/lib/retry";

type RoomStatus = "idle" | "creating" | "joining" | "waiting" | "playing" | "finished" | "error";

interface PlayerData {
  id: string;
  player_name: string;
  score: number;
  max_combo: number;
  chain_count: number;
  is_finished: boolean;
  round_scores: number[];
}

interface RoomData {
  id: string;
  code: string;
  game_mode: string;
  difficulty: string;
  total_rounds: number;
  seed: number;
  status: string;
}

interface PendingScoreUpdate {
  chainCount: number;
  finished: boolean;
  maxCombo: number;
  playerId: string;
  roomId: string | null;
  roundScores: number[];
  score: number;
}

export function useMultiplayer() {
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [room, setRoom] = useState<RoomData | null>(null);
  const [myPlayer, setMyPlayer] = useState<PlayerData | null>(null);
  const [opponent, setOpponent] = useState<PlayerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string>(crypto.randomUUID());
  const channelRef = useRef<any>(null);
  const roomRef = useRef<RoomData | null>(null);
  const myPlayerRef = useRef<PlayerData | null>(null);
  const opponentRef = useRef<PlayerData | null>(null);
  const pendingActionRef = useRef<"create" | "join" | null>(null);
  const pendingScoreUpdateRef = useRef<PendingScoreUpdate | null>(null);

  function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  const toPlayerData = useCallback((data: any): PlayerData => ({
    id: data.id,
    player_name: data.player_name,
    score: Number(data.score ?? 0),
    max_combo: data.max_combo ?? 0,
    chain_count: data.chain_count ?? 0,
    is_finished: Boolean(data.is_finished),
    round_scores: Array.isArray(data.round_scores) ? data.round_scores : [],
  }), []);

  const setMyPlayerState = useCallback((nextPlayer: PlayerData | null) => {
    myPlayerRef.current = nextPlayer;

    if (nextPlayer?.is_finished) {
      pendingScoreUpdateRef.current = null;
    }

    setMyPlayer(nextPlayer);
  }, []);

  const setOpponentState = useCallback((nextPlayer: PlayerData | null) => {
    opponentRef.current = nextPlayer;
    setOpponent(nextPlayer);
  }, []);

  const syncFinishedRoomState = useCallback((nextMyPlayer: PlayerData | null, nextOpponent: PlayerData | null) => {
    if (!nextMyPlayer?.is_finished || !nextOpponent?.is_finished) return;

    roomRef.current = roomRef.current ? { ...roomRef.current, status: "finished" } : roomRef.current;
    setRoom(prev => prev ? { ...prev, status: "finished" } : prev);
    setStatus("finished");
  }, []);

  const subscribeToRoom = useCallback((roomId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const data = payload.new as any;
          if (!data) return;

          const nextPlayer = toPlayerData(data);
          let nextMyPlayer = myPlayerRef.current;
          let nextOpponent = opponentRef.current;

          if (data.player_token === tokenRef.current) {
            nextMyPlayer = nextPlayer;
            setMyPlayerState(nextPlayer);
          } else {
            nextOpponent = nextPlayer;
            setOpponentState(nextPlayer);
          }

          syncFinishedRoomState(nextMyPlayer, nextOpponent);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const data = payload.new as any;
          if (data.status === "playing") setStatus("playing");
          if (data.status === "finished") setStatus("finished");
          setRoom(prev => prev ? { ...prev, status: data.status } : prev);
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [setMyPlayerState, setOpponentState, syncFinishedRoomState, toPlayerData]);

  const fetchPlayers = useCallback(async (roomId: string, playerToken = tokenRef.current) => {
    const { data } = await supabase
      .from("game_players")
      .select("*")
      .eq("room_id", roomId);

    if (!data) return;

    let nextMyPlayer: PlayerData | null = null;
    let nextOpponent: PlayerData | null = null;

    for (const player of data) {
      if (player.player_token === playerToken) {
        nextMyPlayer = toPlayerData(player);
      } else {
        nextOpponent = toPlayerData(player);
      }
    }

    setMyPlayerState(nextMyPlayer);
    setOpponentState(nextOpponent);
    syncFinishedRoomState(nextMyPlayer, nextOpponent);
  }, [setMyPlayerState, setOpponentState, syncFinishedRoomState, toPlayerData]);

  const persistScoreUpdate = useCallback(async (payload: PendingScoreUpdate) => {
    await runWithRetry(async () => {
      const { data, error } = await supabase.rpc("update_player_data", {
        p_player_id: payload.playerId,
        p_player_token: tokenRef.current,
        p_score: payload.score,
        p_max_combo: payload.maxCombo,
        p_chain_count: payload.chainCount,
        p_round_scores: payload.roundScores,
        p_is_finished: payload.finished,
      });

      if (error) throw error;
      if (!data) throw new Error("Player update rejected");

      return data;
    }, {
      attempts: payload.finished ? 5 : 3,
      delayMs: 400,
    });

    if (payload.finished && payload.roomId) {
      await runWithRetry(async () => {
        const { error } = await supabase.rpc("finish_game_room", {
          p_room_id: payload.roomId,
          p_player_token: tokenRef.current,
        });

        if (error) throw error;

        return true;
      }, {
        attempts: 3,
        delayMs: 400,
      });

      await fetchPlayers(payload.roomId, tokenRef.current);
    }
  }, [fetchPlayers]);

  const retryPendingScoreUpdate = useCallback(async () => {
    const pendingScoreUpdate = pendingScoreUpdateRef.current;

    if (!pendingScoreUpdate || myPlayerRef.current?.is_finished) return;

    try {
      await persistScoreUpdate(pendingScoreUpdate);
      pendingScoreUpdateRef.current = null;
      setError(null);
    } catch {
      return;
    }
  }, [persistScoreUpdate]);

  async function createRoom(playerName: string, gameMode: string, difficulty: string, totalRounds: number) {
    if (pendingActionRef.current) return;

    pendingActionRef.current = "create";
    setError(null);
    setStatus("creating");
    setMyPlayer(null);
    setOpponent(null);
    myPlayerRef.current = null;
    opponentRef.current = null;
    roomRef.current = null;
    pendingScoreUpdateRef.current = null;

    const playerToken = crypto.randomUUID();
    tokenRef.current = playerToken;

    try {
      const code = generateCode();
      const seed = Math.floor(Math.random() * 1000000);

      const { data: roomData, error: roomErr } = await supabase
        .from("game_rooms")
        .insert({
          code,
          game_mode: gameMode,
          difficulty: difficulty,
          total_rounds: totalRounds,
          seed,
          status: "waiting",
        })
        .select()
        .single();

      if (roomErr || !roomData) {
        setError("Erreur lors de la création de la partie");
        setStatus("error");
        return;
      }

      const { error: playerErr } = await supabase
        .from("game_players")
        .insert({
          room_id: roomData.id,
          player_name: playerName,
          player_token: playerToken,
        });

      if (playerErr) {
        setError("Erreur lors de l'inscription");
        setStatus("error");
        return;
      }

      const nextRoom = {
        id: roomData.id,
        code: roomData.code,
        game_mode: roomData.game_mode,
        difficulty: roomData.difficulty,
        total_rounds: roomData.total_rounds,
        seed: roomData.seed,
        status: roomData.status,
      };

      roomRef.current = nextRoom;
      setRoom(nextRoom);
      setStatus("waiting");
      subscribeToRoom(roomData.id);
      await fetchPlayers(roomData.id, playerToken);
    } finally {
      pendingActionRef.current = null;
    }
  }

  async function joinRoom(playerName: string, code: string) {
    if (pendingActionRef.current) return;

    pendingActionRef.current = "join";
    setError(null);
    setStatus("joining");
    setMyPlayer(null);
    setOpponent(null);
    myPlayerRef.current = null;
    opponentRef.current = null;
    roomRef.current = null;
    pendingScoreUpdateRef.current = null;

    const playerToken = crypto.randomUUID();
    tokenRef.current = playerToken;

    try {
      const { data: roomData, error: roomErr } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .eq("status", "waiting")
        .single();

      if (roomErr || !roomData) {
        setError("Partie introuvable ou déjà commencée");
        setStatus("error");
        return;
      }

      const { error: playerErr } = await supabase
        .from("game_players")
        .insert({
          room_id: roomData.id,
          player_name: playerName,
          player_token: playerToken,
        });

      if (playerErr) {
        setError(playerErr.message.includes("full") ? "La partie est pleine (2 joueurs max)" : "Erreur en rejoignant la partie");
        setStatus("error");
        return;
      }

      const { error: startErr } = await supabase.rpc("start_game_room", {
        p_room_id: roomData.id,
        p_player_token: playerToken,
      });

      if (startErr) {
        setError("Erreur au démarrage de la partie");
        setStatus("error");
        return;
      }

      const nextRoom = {
        id: roomData.id,
        code: roomData.code,
        game_mode: roomData.game_mode,
        difficulty: roomData.difficulty,
        total_rounds: roomData.total_rounds,
        seed: roomData.seed,
        status: "playing",
      };

      roomRef.current = nextRoom;
      setRoom(nextRoom);
      setStatus("playing");
      subscribeToRoom(roomData.id);
      await fetchPlayers(roomData.id, playerToken);
    } finally {
      pendingActionRef.current = null;
    }
  }

  async function updateScore(score: number, maxCombo: number, roundScores: number[], chainCount = 0, finished = false) {
    const currentPlayer = myPlayerRef.current;
    const currentRoom = roomRef.current;

    if (!currentPlayer) return;

    const nextPlayer: PlayerData = {
      ...currentPlayer,
      score,
      max_combo: maxCombo,
      chain_count: chainCount,
      is_finished: finished,
      round_scores: [...roundScores],
    };

    const payload: PendingScoreUpdate = {
      chainCount,
      finished,
      maxCombo,
      playerId: currentPlayer.id,
      roomId: currentRoom?.id ?? null,
      roundScores: [...roundScores],
      score,
    };

    setMyPlayerState(nextPlayer);

    if (finished) {
      pendingScoreUpdateRef.current = payload;
    }

    try {
      await persistScoreUpdate(payload);

      if (finished) {
        pendingScoreUpdateRef.current = null;
      }

      setError(null);
    } catch {
      if (!finished) {
        setError("Erreur de synchronisation du score");
      }
    }
  }

  function leaveRoom() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    pendingActionRef.current = null;
    pendingScoreUpdateRef.current = null;
    roomRef.current = null;
    myPlayerRef.current = null;
    opponentRef.current = null;
    setRoom(null);
    setMyPlayer(null);
    setOpponent(null);
    setStatus("idle");
    setError(null);
  }

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    myPlayerRef.current = myPlayer;
  }, [myPlayer]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  const refreshPlayers = useCallback(async () => {
    const currentRoom = roomRef.current;

    if (!currentRoom) return;

    await fetchPlayers(currentRoom.id);

    if (pendingScoreUpdateRef.current && !myPlayerRef.current?.is_finished) {
      await retryPendingScoreUpdate();
    }
  }, [fetchPlayers, retryPendingScoreUpdate]);

  return {
    status,
    room,
    myPlayer,
    opponent,
    error,
    createRoom,
    joinRoom,
    updateScore,
    leaveRoom,
    setStatus,
    setError,
    refreshPlayers,
  };
}
