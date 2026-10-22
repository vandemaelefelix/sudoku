import { get } from '../api/client'
import type { StartCounts } from '../api/types'
import { Failure, Working } from '../components/Frame'
import { FLOWS, nextStep, type FlowId } from '../flows'
import { go, useKeys, useLoad } from '../hooks'

export function Start() {
  const counts = useLoad(() => get<StartCounts>('/api/start'), 'start')
  useKeys({
    a: () => counts.data && go(nextStep('a', counts.data).route),
    b: () => counts.data && go(nextStep('b', counts.data).route),
  })
  if (counts.error) return <Failure message={counts.error} retry={counts.reload} />
  if (!counts.data) return <Working what="Counting the open work…" />
  const data = counts.data
  return (
    <div className="start">
      <header className="start-head">
        <h1>Cell labels</h1>
        <p>Pick a flow. Each step shows what waits. The highlighted step is next.</p>
      </header>
      <div className="flows">
        {(['a', 'b'] as FlowId[]).map((flow) => {
          const next = nextStep(flow, data)
          return (
            <section key={flow} className="flow-card" aria-label={FLOWS[flow].name}>
              <h2>{FLOWS[flow].name}</h2>
              <p className="about">{FLOWS[flow].about}</p>
              <ol className="flow-steps">
                {FLOWS[flow].steps.map((s, n) => {
                  const open = s.count(data)
                  return (
                    <li key={s.id} className={s.id === next.id ? 'next' : open ? 'open' : 'done'}>
                      <a href={`#/${s.route}`}>
                        <span className="number">{n + 1}</span>
                        <span className="name">{s.name}</span>
                        <span className="count">{open ?? s.idle?.(data) ?? 'Done'}</span>
                      </a>
                    </li>
                  )
                })}
              </ol>
              <button type="button" className="primary" onClick={() => go(next.route)}>
                Next: {next.name} <kbd>{flow.toUpperCase()}</kbd>
              </button>
            </section>
          )
        })}
      </div>
    </div>
  )
}
