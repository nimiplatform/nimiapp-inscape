// IS-IA-02 — distribution-first type display. The function-stack posterior is
// the primary surface; the 4-letter code appears only as a small legibility
// label, never as "your type is X" hero text.

import { COGNITIVE_FUNCTIONS, DICHOTOMIES } from '../../domain/typology.ts';
import type { TypeProfile } from '../../domain/type-profile.ts';

export function TypeProfileView({ profile }: { profile: TypeProfile }) {
  const functions = [...COGNITIVE_FUNCTIONS].sort(
    (a, b) => profile.function_stack_posterior[b].strength - profile.function_stack_posterior[a].strength,
  );

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-70">
        {profile.leading_type ? (
          <>
            这一模式常被描述为 <span className="font-medium">{profile.leading_type}</span>
            ，但功能栈才是真正的信息。
          </>
        ) : (
          <>分布尚未足够明确以命名一个 4 字母代码。</>
        )}
      </p>

      <div>
        <h3 className="mb-2 text-sm font-medium">功能栈后验</h3>
        <ul className="space-y-1">
          {functions.map((fn) => {
            const value = profile.function_stack_posterior[fn];
            return (
              <li key={fn} className="flex items-center gap-2 text-xs">
                <span className="w-8 font-medium">{fn}</span>
                <span className="h-2 flex-1 rounded bg-black/5">
                  <span
                    className="block h-2 rounded bg-black/40"
                    style={{ width: `${Math.round(value.strength * 100)}%` }}
                  />
                </span>
                <span className="w-10 text-right tabular-nums opacity-60">
                  {value.strength.toFixed(2)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">维度分布</h3>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs opacity-80">
          {DICHOTOMIES.map((dichotomy) => {
            const value = profile.dichotomy_distribution[dichotomy];
            return (
              <li key={dichotomy} className="flex justify-between">
                <span>{dichotomy}</span>
                <span className="tabular-nums">{value.value.toFixed(2)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs opacity-50">
        类型是会移动的分布，不是固定标签。
      </p>
    </div>
  );
}
