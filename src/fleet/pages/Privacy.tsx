import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGeoConsent } from "../consent";
import { dateFr } from "../format";

const RETENTION_MONTHS = 12;

export default function Privacy() {
  const { granted, since, revoke } = useGeoConsent();

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <Button variant="ghost" className="mb-2" asChild>
        <Link to="/salarie">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
      </Button>

      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Confidentialité & géolocalisation</h1>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Information RGPD</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Conformément au RGPD et aux recommandations de la CNIL, la géolocalisation de votre véhicule de
            fonction n'est activée <strong>qu'avec votre consentement explicite</strong> et uniquement pendant vos
            trajets professionnels.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Finalité :</strong> suivi des trajets professionnels et du kilométrage du véhicule de société.</li>
            <li><strong>Données collectées :</strong> position GPS pendant un trajet, distance et durée.</li>
            <li><strong>Base légale :</strong> intérêt légitime de l'employeur, sous réserve de votre consentement.</li>
            <li><strong>Conservation :</strong> {RETENTION_MONTHS} mois maximum, puis suppression automatique.</li>
            <li><strong>Désactivation :</strong> aucune localisation en dehors d'un trajet que vous démarrez vous-même.</li>
            <li><strong>Vos droits :</strong> accès, rectification, effacement et retrait du consentement à tout moment.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mon consentement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {granted ? (
            <>
              <p className="text-muted-foreground">
                Consentement accordé{since ? ` le ${dateFr(since)}` : ""}.
              </p>
              <Button variant="outline" onClick={revoke}>
                Retirer mon consentement
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">
              Vous n'avez pas activé la géolocalisation. Elle vous sera proposée au démarrage d'un trajet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
