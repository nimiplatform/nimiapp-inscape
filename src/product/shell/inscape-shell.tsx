import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Compass,
  Fingerprint,
  Leaf,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from 'lucide-react';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { FACES, type FaceId } from '../navigation/tab-descriptor.ts';
import { TodayFace } from '../faces/today-face.tsx';
import { RelationshipFace } from '../faces/relationship-face.tsx';
import { SelfFace } from '../faces/self-face.tsx';
import { PersistedLanguageSwitch } from '../settings/language-switch.tsx';
import { Brand } from '../components/primitives.tsx';
import { PrivacySettings } from '../settings/privacy-settings.tsx';

const icons = { today: Compass, relationship: Users, self: Fingerprint };

// @nimi-authority: rule.inscape.product.r007
export function InscapeShell() {
  const { t } = useTranslation();
  const [active, setActive] = useState<FaceId>('today');
  const [collapsed, setCollapsed] = useState(false);
  const [archive, setArchive] = useState(false);
  const [visited, setVisited] = useState<FaceId[]>(['today']);
  const scrollContainer = useRef<HTMLElement>(null);
  const count = useInscapeStore((s) => s.space?.self_subject.reflection_entries.length ?? 0);
  const profile = useInscapeStore((s) => s.space?.self_subject.type_profile);
  function navigate(face: FaceId, showArchive = false) {
    if (scrollContainer.current) scrollContainer.current.scrollTop = 0;
    setActive(face);
    setArchive(showArchive);
    setVisited((list) => (list.includes(face) ? list : [...list, face]));
  }
  return (
    <div className={`inscape-workspace ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="inscape-sidebar">
        <Brand compact={collapsed} />
        <div className="nav-section-label">{t('Experience.mySpace')}</div>
        <nav className="primary-nav" aria-label={t('Navigation.ariaLabel')}>
          {FACES.map((face) => {
            const Icon = icons[face.id];
            return (
              <button
                key={face.id}
                title={t(`Navigation.faces.${face.id}`)}
                aria-current={active === face.id ? 'page' : undefined}
                className={active === face.id ? 'active' : ''}
                onClick={() => navigate(face.id)}
              >
                <Icon size={20} strokeWidth={1.7} />
                <span>{t(`Navigation.faces.${face.id}`)}</span>
                {active === face.id && <i />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-divider" />
        <button
          className="archive-nav"
          title={t('Experience.archive')}
          onClick={() => navigate('self', true)}
        >
          <BookOpen size={19} strokeWidth={1.6} />
          <span>{t('Experience.archive')}</span>
          {count > 0 && <small>{count}</small>}
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-thought">
            <Leaf size={21} strokeWidth={1.5} />
            <p>{t('Experience.sidebarThought')}</p>
            <small>{t('Experience.sidebarThoughtNote')}</small>
          </div>
          <PrivacySettings />
          <div className="local-status">
            <span className="status-dot" />
            <span>{t('Experience.localSpace')}</span>
            <LockKeyhole size={13} />
          </div>
          <div className="sidebar-profile">
            <span className="personal-mark">
              <Fingerprint size={22} />
            </span>
            <span>
              <strong>{t('Experience.explorer')}</strong>
              <small>
                {profile?.leading_type
                  ? t('Experience.patternLabel', { type: profile.leading_type })
                  : t('Experience.stillBecoming')}
              </small>
            </span>
            <button
              className="icon-button collapse-button"
              aria-label={t(collapsed ? 'Experience.expandNav' : 'Experience.collapseNav')}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <span>{t('Experience.mySpace')}</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{t(`Navigation.faces.${active}`)}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <LockKeyhole size={12} />
              {t('Experience.private')}
            </span>
            <PersistedLanguageSwitch />
          </div>
        </header>
        <main className="workspace-scroll" ref={scrollContainer}>
          <div hidden={active !== 'today'} className="face-container">
            <TodayFace onNavigate={navigate} />
          </div>
          {visited.includes('relationship') && (
            <div hidden={active !== 'relationship'} className="face-container">
              <RelationshipFace />
            </div>
          )}
          {visited.includes('self') && (
            <div hidden={active !== 'self'} className="face-container">
              <SelfFace showArchive={archive} onExplore={() => navigate('today')} />
            </div>
          )}
          <footer className="product-footer">
            <Leaf size={12} />
            <span>{t('Experience.disclaimer')}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
