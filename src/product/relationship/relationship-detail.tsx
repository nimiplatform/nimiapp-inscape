// IS-IA / IS-AI — relationship detail: paste conversation snippets (user-driven
// only) and run a Mode D friction read (two-sided). Communication rewrite
// (Mode C, 4-layer anti-manipulation) lands in wave-4.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nimiToast } from '@nimiplatform/kit/ui';
import { useInscapeStore } from '../state/inscape-store-provider.tsx';
import { createInscapeRuntimeAiClient } from '../../shell/ai/inscape-runtime-ai-client.ts';
import { buildFrictionPrompt } from './relationship-prompts.ts';
import { CommunicationRewrite } from './communication-rewrite.tsx';
import { DyadInsight } from './dyad-insight.tsx';
import type { Relationship } from '../../domain/relationship.ts';
import type { Subject } from '../../domain/subject.ts';

export function RelationshipDetail({
  relationship,
  other,
}: {
  relationship: Relationship;
  other: Subject | undefined;
}) {
  const { t } = useTranslation();
  const addCommunicationLog = useInscapeStore((s) => s.addCommunicationLog);
  const quarantineOtherSubject = useInscapeStore((s) => s.quarantineOtherSubject);
  const space = useInscapeStore((s) => s.space);
  const selfLeading = space?.self_subject.type_profile?.leading_type ?? null;
  const locale = space?.settings.locale;
  const client = useMemo(() => createInscapeRuntimeAiClient(), []);

  const [snippet, setSnippet] = useState('');
  const [friction, setFriction] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmQuarantine, setConfirmQuarantine] = useState(false);

  function onAddSnippet() {
    const trimmed = snippet.trim();
    if (!trimmed) return;
    void addCommunicationLog(relationship.id, trimmed, new Date().toISOString());
    setSnippet('');
  }

  async function onAnalyze() {
    if (working || relationship.communication_logs.length === 0) return;
    setWorking(true);
    setFriction(null);
    const result = await client.generate(
      buildFrictionPrompt(
        relationship.communication_logs.map((l) => l.snippet),
        selfLeading,
        relationship.nature,
        locale,
      ),
    );
    if (result.ok) {
      setFriction(result.text);
    } else {
      nimiToast.danger(
        t('Common.aiUnavailable', { error: `${result.failure.kind}: ${result.failure.detail}` }),
      );
    }
    setWorking(false);
  }

  return (
    <div className="space-y-2 rounded border border-black/10 p-3">
      <h4 className="text-sm font-medium">
        {t('Relationship.buttonLabel', {
          name: other?.display_name ?? t('Common.unknown'),
          nature: t(`RelationshipNature.${relationship.nature}`),
        })}
      </h4>

      <DyadInsight relationship={relationship} other={other} />

      <div className="flex gap-2 border-t border-black/10 pt-3">
        <input
          value={snippet}
          onChange={(e) => setSnippet(e.target.value)}
          placeholder={t('RelationshipDetail.snippetPlaceholder')}
          className="flex-1 rounded border border-black/15 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={onAddSnippet}
          disabled={!snippet.trim()}
          className="rounded border border-black/15 px-2 py-1 text-sm disabled:opacity-40"
        >
          {t('RelationshipDetail.addSnippet')}
        </button>
      </div>
      <p className="text-xs opacity-60">
        {t('RelationshipDetail.collectedSnippets', {
          count: relationship.communication_logs.length,
        })}
      </p>
      <button
        type="button"
        onClick={() => void onAnalyze()}
        disabled={working || relationship.communication_logs.length === 0}
        className="rounded bg-black/80 px-3 py-1 text-sm text-white disabled:opacity-40"
      >
        {working ? t('RelationshipDetail.analyzing') : t('RelationshipDetail.analyze')}
      </button>
      {friction && (
        <div className="whitespace-pre-wrap rounded border border-black/10 bg-black/[0.02] p-3 text-sm">
          {friction}
        </div>
      )}

      <div className="border-t border-black/10 pt-3">
        <CommunicationRewrite
          recipientName={other?.display_name ?? t('Common.unknown')}
          nature={relationship.nature}
        />
      </div>

      <div className="border-t border-black/10 pt-3">
        {confirmQuarantine ? (
          <div className="space-y-1 text-xs">
            <p className="text-amber-700">{t('RelationshipDetail.quarantineWarning')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void quarantineOtherSubject(relationship.other_subject_id, new Date().toISOString()).then(() => {
                    nimiToast.success(t('RelationshipDetail.quarantined'));
                  });
                }}
                className="rounded bg-amber-600 px-2 py-1 text-white"
              >
                {t('RelationshipDetail.confirmQuarantine')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmQuarantine(false)}
                className="rounded border border-black/15 px-2 py-1"
              >
                {t('RelationshipDetail.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmQuarantine(true)}
            className="text-xs text-amber-700 hover:underline"
          >
            {t('RelationshipDetail.markUnder18')}
          </button>
        )}
      </div>
    </div>
  );
}
