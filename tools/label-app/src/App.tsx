import { useRoute } from './hooks'
import { Cells } from './steps/Cells'
import { Digits } from './steps/Digits'
import { Doubtful } from './steps/Doubtful'
import { Fetch } from './steps/Fetch'
import { Finish } from './steps/Finish'
import { Kinds } from './steps/Kinds'
import { OutlineLarge } from './steps/OutlineLarge'
import { Outlines } from './steps/Outlines'
import { Prelabel } from './steps/Prelabel'
import { Start } from './steps/Start'
import type { FlowId } from './flows'

export function App() {
  const [flow, step, item] = useRoute()
  if (flow === 'a') {
    if (step === 'fetch') return <Fetch />
    if (step === 'outlines') return item ? <OutlineLarge photo={item} /> : <Outlines />
    if (step === 'cells') return <Cells photo={item} />
  }
  if (flow === 'b') {
    if (step === 'prelabel') return <Prelabel />
    if (step === 'digits') return <Digits digit={item} />
    if (step === 'kinds') return <Kinds />
    if (step === 'doubtful') return <Doubtful />
  }
  if ((flow === 'a' || flow === 'b') && step === 'finish') return <Finish flow={flow as FlowId} />
  return <Start />
}
