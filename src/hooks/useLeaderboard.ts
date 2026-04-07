import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardEntry {
  rank: number;
  player_name: string;
  score: number;
  max_combo: number;
  total_rounds: number;
  created_at: string;
  pts?: number;
  played?: number;
  wins?: number;
  draws?: number;
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

  const fetchLeaderboard = useCallback(async (gameMode: string, difficulty: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("get_leaderboard", {
        p_game_mode: gameMode,
        p_difficulty: difficulty,
      });
      if (err) throw err;
      setEntries((data as LeaderboardEntry[]) ?? []);
    } catch (e: any) {
      setError(e.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  const submitScore = useCallback(async (params: {
    playerName: string;
    score: number;
    gameMode: string;
    difficulty: string;
    totalRounds: number;
    maxCombo: number;
  }) => {
    try {
      const { error: err } = await supabase.rpc("submit_score", {
        p_player_name:  params.playerName,
        p_score:        params.score,
        p_game_mode:    params.gameMode,
        p_difficulty:   params.difficulty,
        p_total_rounds: params.totalRounds,
        p_max_combo:    params.maxCombo,
      });
      if (err) throw err;

      const { data } = await supabase.rpc("get_leaderboard", {
        p_game_mode: params.gameMode,
        p_difficulty: params.difficulty,
      });
      const list = (data as LeaderboardEntry[]) ?? [];
      setEntries(list);

      const myEntry = [...list]
        .reverse()
        .find(e => e.player_name === params.playerName.trim() && e.score === params.score);
      setMyRank(myEntry ? Number(myEntry.rank) : null);
    } catch (e: any) {
      console.error("Failed to submit score:", e.message);
    }
  }, []);

  return { entries, loading, error, myRank, fetchLeaderboard, submitScore };
}
