import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  HeartHandshake,
  MessagesSquare,
  Shuffle,
  Sparkles,
  Sprout,
  Sun,
} from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { ChoiceGroup } from '../components/interaction.tsx';
import { PageHeading, TextLink } from '../components/primitives.tsx';
import { ExplorationSession, MOODS } from '../explore/exploration-session.tsx';
import type { ExplorationMode } from '../../domain/exploration.ts';
import type { FaceId } from '../navigation/tab-descriptor.ts';
import { TodaysRead } from '../today/todays-read.tsx';

type Session = { mode: ExplorationMode; text?: string; existingId?: string; mood?: string };

export function TodayFace({
  onNavigate,
}: {
  onNavigate: (face: FaceId, archive?: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const reflections = useInscapeStore((s) => s.space?.self_subject.reflection_entries ?? []);
  const [session, setSession] = useState<Session | null>(null);
  const [mood, setMood] = useState('');
  const [card, setCard] = useState(() => Math.floor(Math.random() * 8));
  const [revealed, setRevealed] = useState(false);
  const [showRead, setShowRead] = useState(false);
  const recent = [...reflections].reverse().slice(0, 3);
  const date = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());
  // @nimi-authority: rule.inscape.data-model.r007
  return (
    <>
      {session && (
        <ExplorationSession
          key={session.existingId ?? `${session.mode}-${session.text ?? ''}`}
          mode={session.mode}
          initialText={session.text}
          initialMood={session.mood ?? mood}
          existingId={session.existingId}
          onBack={() => setSession(null)}
        />
      )}
      <section className="today-face" hidden={!!session}>
        <PageHeading
          eyebrow={date}
          title={t('Experience.todayTitle')}
          description={t('Experience.todayDescription')}
          action={
            <span className="day-symbol">
              <Sun size={28} strokeWidth={1.4} />
            </span>
          }
        />
        <div className="today-hero">
          <div className="hero-content">
            <span className="eyebrow">
              <Sparkles size={13} />
              {t('Experience.heroEyebrow')}
            </span>
            <h2>
              {t('Experience.heroTitle1')}
              <br />
              {t('Experience.heroTitle2')}
            </h2>
            <p>{t('Experience.heroDescription')}</p>
            <button
              className="button button-primary"
              onClick={() => setSession({ mode: 'resonance' })}
            >
              {t('Experience.heroAction')}
              <ArrowUpRight size={17} />
            </button>
          </div>
          <span className="hero-caption">{t('Experience.heroCaption')}</span>
        </div>
        <div className="mood-bar">
          <div>
            <span className="small-label">{t('Experience.pause')}</span>
            <strong>{t('Experience.moodQuestion')}</strong>
          </div>
          <ChoiceGroup
            className="mood-options"
            label={t('Experience.moodQuestion')}
            value={mood}
            onChange={setMood}
            items={[
              { value: '', label: t('Repair.noMood'), className: 'mood-chip' },
              ...MOODS.map((value) => ({
                value,
                className: 'mood-chip',
                label: (
                  <>
                    <span className={'mood-dot ' + value} />
                    {t('Experience.moods.' + value)}
                  </>
                ),
              })),
            ]}
          />
          {mood && (
            <button
              className="mood-next icon-button"
              aria-label={t('Experience.exploreMood')}
              onClick={() => setSession({ mode: 'resonance', mood })}
            >
              <ArrowRight size={17} />
            </button>
          )}
        </div>
        <div className="section-heading">
          <div>
            <h2>{t('Experience.exploreTitle')}</h2>
            <span>{t('Experience.exploreSubtitle')}</span>
          </div>
          <span className="section-kicker">{t('Experience.madeForMoment')}</span>
        </div>
        <div className="path-grid">
          <button className="path-card sage" onClick={() => setSession({ mode: 'roundtable' })}>
            <div className="path-top">
              <span className="path-icon">
                <MessagesSquare size={25} strokeWidth={1.5} />
              </span>
              <span className="pill">{t('Experience.withAI')}</span>
            </div>
            <h3>{t('Experience.roundtableTitle')}</h3>
            <p>{t('Experience.roundtableDescription')}</p>
            <div className="path-bottom">
              <span>{t('Experience.roundtableMeta')}</span>
              <ArrowUpRight size={19} />
            </div>
          </button>
          <button
            className="path-card peach"
            onClick={() => setSession({ mode: 'resonance', text: t('Experience.emotionStarter') })}
          >
            <div className="path-top">
              <span className="path-icon">
                <Sparkles size={25} strokeWidth={1.5} />
              </span>
              <span className="pill">{t('Experience.withAI')}</span>
            </div>
            <h3>{t('Experience.emotionTitle')}</h3>
            <p>{t('Experience.emotionDescription')}</p>
            <div className="path-bottom">
              <span>{t('Experience.emotionMeta')}</span>
              <ArrowUpRight size={19} />
            </div>
          </button>
          <button className="path-card lavender" onClick={() => onNavigate('relationship')}>
            <div className="path-top">
              <span className="path-icon">
                <HeartHandshake size={25} strokeWidth={1.5} />
              </span>
              <span className="pill">{t('Experience.withAI')}</span>
            </div>
            <h3>{t('Experience.relationshipTitle')}</h3>
            <p>{t('Experience.relationshipDescription')}</p>
            <div className="path-bottom">
              <span>{t('Experience.relationshipMeta')}</span>
              <ArrowUpRight size={19} />
            </div>
          </button>
        </div>
        <div className="today-bottom-grid">
          <div className={`discovery-card ${revealed ? 'revealed' : ''}`}>
            <div className="discovery-top">
              <span className="eyebrow">
                <CircleHelp size={14} />
                {t('Experience.discoveryCard')}
              </span>
              <button
                className="icon-button"
                aria-label={t('Experience.shuffle')}
                onClick={() => {
                  setCard((card + 1 + Math.floor(Math.random() * 7)) % 8);
                  setRevealed(false);
                }}
              >
                <Shuffle size={15} />
              </button>
            </div>
            <span className="card-index">{String(card + 1).padStart(2, '0')} / 08</span>
            <h3>{t(`Discovery.${card}.question`)}</h3>
            {revealed ? (
              <div className="card-reveal">
                <p>{t(`Discovery.${card}.hint`)}</p>
                <TextLink
                  onClick={() =>
                    setSession({ mode: 'resonance', text: `${t(`Discovery.${card}.question`)}\n\n` })
                  }
                >
                  {t('Experience.writeAboutIt')}
                </TextLink>
              </div>
            ) : (
              <button className="discovery-reveal" onClick={() => setRevealed(true)}>
                {t('Experience.turnCard')}
                <ArrowRight size={15} />
              </button>
            )}
          </div>
          <div className="recent-section">
            <div className="section-heading">
              <h2>
                <BookOpen size={16} />
                {t('Experience.recentTitle')}
              </h2>
              <TextLink onClick={() => onNavigate('self', true)}>
                {t('Experience.allEntries')}
              </TextLink>
            </div>
            {recent.length === 0 ? (
              <div className="recent-empty">
                <Sprout size={27} strokeWidth={1.4} />
                <h3>{t('Experience.emptyTitle')}</h3>
                <p>{t('Experience.emptyDescription')}</p>
                <button className="text-link" onClick={() => setSession({ mode: 'resonance' })}>
                  {t('Experience.firstEntry')}
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="recent-list">
                {recent.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() =>
                      setSession({
                        mode: entry.exploration?.mode ?? 'resonance',
                        existingId: entry.id,
                      })
                    }
                  >
                    <span className="entry-leaf">
                      <Sprout size={16} />
                    </span>
                    <span>
                      <strong>{entry.exploration?.read?.title ?? entry.text}</strong>
                      <small>
                        {new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-US' : 'zh-CN', {
                          month: 'short',
                          day: 'numeric',
                        }).format(new Date(entry.created_at))}
                        {entry.exploration?.read ? ` · ${t('Experience.explored')}` : ''}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            )}
            {reflections.length > 0 && (
              <div className="recent-read">
                <button
                  className="text-link"
                  onClick={() => setShowRead(!showRead)}
                  aria-expanded={showRead}
                >
                  <Sparkles size={14} />
                  {t('Experience.connectDots')}
                </button>
                <div hidden={!showRead}>
                  <TodaysRead />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
