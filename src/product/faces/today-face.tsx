// IS-IA — Today face. Today's read (Mode B), eight-function decision aid
// (Mode B), and the reflection journal (Mode E + Mode A / T1-11) are all live.

import { TodaysRead } from '../today/todays-read.tsx';
import { DecisionAid } from '../today/decision-aid.tsx';
import { ReflectionJournal } from '../today/reflection-journal.tsx';
import { useTranslation } from 'react-i18next';

export function TodayFace() {
  const { t } = useTranslation();
  return (
    <section className="space-y-8">
      <h2 className="text-lg font-medium">{t('Today.title')}</h2>
      <TodaysRead />
      <DecisionAid />
      <ReflectionJournal />
    </section>
  );
}
