import { Button } from "../../atoms/Button/Button";
import { ArtistCard } from "../../molecules/ArtistCard/ArtistCard";
import type { Dub } from "../../types/domain";
import "./DubStatistics.css";

export interface DubStatisticsProps {
  dub: Dub;
  onRevokeGrant?: (dubId: string, userId: string) => void;
  onOpenProfile?: (username: string) => void;
}

export function DubStatistics({ dub, onRevokeGrant, onOpenProfile }: DubStatisticsProps) {
  const maxValue = Math.max(dub.downloads, dub.likes, 1);
  const metrics = [
    { label: "Downloads", value: dub.downloads, variant: "downloads" },
    { label: "Unique Supporters", value: dub.likes, variant: "supporters" },
  ];

  return (
    <div className="dub-statistics">
      <div className="dub-statistics__header"><h3>Performance</h3></div>
      <div className="dub-statistics__layout">
        <div className="dub-statistics__chart-column">
          <div className="dub-statistics__charts">
            {metrics.map((metric) => (
              <div className="dub-statistics__metric" key={metric.variant}>
                <div className="dub-statistics__metric-header">
                  <span className="dub-statistics__label">{metric.label}</span>
                  <span className="dub-statistics__value">{metric.value.toLocaleString()}</span>
                </div>
                <div className="dub-statistics__bar-container">
                  <div className={`dub-statistics__bar dub-statistics__bar--${metric.variant}`} style={{ width: `${(metric.value / maxValue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="dub-statistics__note">Downloads are counted when requested, not when the file transfer completes.</p>
        </div>

        <div className="dub-statistics__people">
          {dub.distribution === "private" && (
            <div className="dub-statistics__access">
              <h4>Private Access</h4>
              <p>Share this dub with a friend to grant access in Messenger.</p>
              {dub.grants?.length ? (
                <ul className="dub-statistics__access-list" aria-label={`Private access to ${dub.title}`}>
                  {dub.grants.map((grant) => (
                    <li key={grant.id} className="dub-statistics__access-item">
                      <ArtistCard
                        name={grant.displayName}
                        username={grant.username}
                        avatarUrl={grant.avatarUrl}
                        aListApproved={grant.aListApproved}
                        onOpenProfile={onOpenProfile}
                        action={onRevokeGrant && <Button aria-label={`Revoke access for ${grant.displayName}`} onClick={() => onRevokeGrant(dub.id, grant.id)} size="small" variant="secondary">Revoke</Button>}
                      />
                    </li>
                  ))}
                </ul>
              ) : <p className="dub-statistics__empty">No friends currently have access.</p>}
              <p className="dub-statistics__warning">Revoking access cannot remove files already downloaded.</p>
            </div>
          )}
          {dub.downloaders && dub.downloaders.length > 0 ? (
            <div className="dub-statistics__supporters">
              <h4>Recent Supporters</h4>
              <ul className="dub-statistics__supporter-list" aria-label={`Supporters of ${dub.title}`}>
                {dub.downloaders.slice(0, 5).map((supporter) => (
                  <li key={supporter.username} className="dub-statistics__supporter-item">
                    <ArtistCard name={supporter.displayName} username={supporter.username} avatarUrl={supporter.avatarUrl} aListApproved={supporter.aListApproved} onOpenProfile={onOpenProfile} />
                  </li>
                ))}
              </ul>
              {dub.downloaders.length > 5 && (
                <p className="dub-statistics__more">
                  +{dub.downloaders.length - 5} more supporter{dub.downloaders.length - 5 === 1 ? "" : "s"}
                </p>
              )}
            </div>
          ) : <p className="dub-statistics__empty">{dub.downloaders ? "No supporters yet." : "Supporter details are unavailable."}</p>}
        </div>
      </div>
    </div>
  );
}
