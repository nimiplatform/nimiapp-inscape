import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, BookOpen, Fingerprint, Search, Sprout } from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { InitialTyping } from '../self/initial-typing.tsx';
import { TypeProfileView } from '../self/type-profile-view.tsx';
import { SelfMirror } from '../self/self-mirror.tsx';
import { PageHeading } from '../components/primitives.tsx';
import { Tabs, ChoiceGroup } from '../components/interaction.tsx';
import { TypeReferenceControl } from '../components/record-editors.tsx';
import { ExplorationSession } from '../explore/exploration-session.tsx';

export function SelfFace({
  showArchive = false,
  onExplore,
}: {
  showArchive?: boolean;
  onExplore: () => void;
}) {
  const { t, i18n } = useTranslation();
  const space = useInscapeStore((s) => s.space);
  const setInitialType = useInscapeStore((s) => s.setInitialType);
  const [tab, setTab] = useState(showArchive ? 'journal' : 'map');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    setTab(showArchive ? 'journal' : 'map');
  }, [showArchive]);
  const profile = space?.self_subject.type_profile ?? null;
  const reflections = space?.self_subject.reflection_entries ?? [];
  const selectedEntry = reflections.find((entry) => entry.id === selected);
  const entries = [...reflections]
    .reverse()
    .filter(
      (entry) =>
        `${entry.text} ${entry.exploration?.read?.title ?? ''}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()) &&
        (filter === 'all' ||
          (filter === 'experiments' && !!entry.exploration?.read) ||
          (filter === 'accepted' && entry.exploration?.feedback === 'accepted')),
    );
  // @nimi-authority: rule.inscape.data-model.r007
  return (
    <>
      {selectedEntry && (
        <ExplorationSession
          key={selectedEntry.id}
          mode={selectedEntry.exploration?.mode ?? 'resonance'}
          existingId={selectedEntry.id}
          onBack={() => setSelected(null)}
        />
      )}
      <section hidden={!!selectedEntry}>
        <PageHeading
          eyebrow={t('Experience.selfEyebrow')}
          title={t('Experience.selfTitle')}
          description={t('Experience.selfDescription')}
          action={
            <span className="day-symbol">
              <Fingerprint size={29} strokeWidth={1.3} />
            </span>
          }
        />
        <Tabs
          id="self-views"
          label={t('Experience.selfViews')}
          value={tab}
          onChange={setTab}
          items={[
            {
              value: 'map',
              label: (
                <>
                  <Fingerprint size={17} />
                  {t('Experience.innerMap')}
                </>
              ),
            },
            {
              value: 'journal',
              label: (
                <>
                  <BookOpen size={17} />
                  {t('Experience.archive')}
                  {reflections.length > 0 && <span>{reflections.length}</span>}
                </>
              ),
            },
          ]}
        />
        <div
          className="self-map"
          role="tabpanel"
          id="self-views-panel-map"
          aria-labelledby="self-views-tab-map"
          hidden={tab !== 'map'}
        >
          {profile ? (
            <>
              <div className="record-tools">
                <TypeReferenceControl
                  self
                  value={space?.self_subject.profile_baseline?.leading_type ?? null}
                  onSave={(type) => setInitialType(type, new Date().toISOString())}
                />
              </div>
              <TypeProfileView profile={profile} />
            </>
          ) : (
            <InitialTyping onExplore={onExplore} />
          )}
          <SelfMirror profile={profile} />
          <div className="self-note">
            <Sprout size={25} strokeWidth={1.5} />
            <div>
              <h3>{t('Experience.growthTitle')}</h3>
              <p>{t('Experience.growthDescription')}</p>
            </div>
            <button className="text-link" onClick={onExplore}>
              {t('Experience.keepExploring')}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>
        <div
          className="journal-view"
          role="tabpanel"
          id="self-views-panel-journal"
          aria-labelledby="self-views-tab-journal"
          hidden={tab !== 'journal'}
        >
          <div className="journal-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Experience.searchJournal')}
                aria-label={t('Experience.searchJournal')}
              />
            </label>
            <ChoiceGroup
              label={t('Repair.filterNotes')}
              value={filter}
              onChange={setFilter}
              items={['all', 'accepted', 'experiments'].map((value) => ({
                value,
                label: t('Experience.filters.' + value),
              }))}
            />
          </div>
          {entries.length === 0 ? (
            <div className="empty-space">
              <BookOpen size={34} strokeWidth={1.3} />
              <h3>{t(reflections.length ? 'Experience.noMatches' : 'Experience.emptyTitle')}</h3>
              <p>{t(reflections.length ? 'Experience.trySearch' : 'Experience.emptyDescription')}</p>
              {!reflections.length && (
                <button className="button button-primary" onClick={onExplore}>
                  {t('Experience.firstEntry')}
                  <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          ) : (
            <div className="journal-list">
              {entries.map((entry) => (
                <button
                  className="journal-entry"
                  key={entry.id}
                  onClick={() => setSelected(entry.id)}
                >
                  <div className="journal-date">
                    <strong>{new Date(entry.created_at).getDate()}</strong>
                    <small>
                      {new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'zh-CN', {
                        month: 'short',
                        year: 'numeric',
                      }).format(new Date(entry.created_at))}
                    </small>
                  </div>
                  <div>
                    <div className="entry-tags">
                      <span>
                        {t(
                          entry.exploration?.mode === 'roundtable'
                            ? 'Experience.roundtableTitle'
                            : 'Experience.journalMoment',
                        )}
                      </span>
                      {entry.exploration?.feedback === 'accepted' && (
                        <span>{t('Experience.accepted')}</span>
                      )}
                      {entry.exploration?.experiment_done && (
                        <span>{t('Experience.experimentFinished')}</span>
                      )}
                    </div>
                    <h3>{entry.exploration?.read?.title ?? entry.text}</h3>
                    <p>{entry.text}</p>
                  </div>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
