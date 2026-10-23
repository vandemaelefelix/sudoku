import { useRoute } from './hooks/useRoute'
import { Check } from './steps/check/Check'
import { Doubtful } from './steps/Doubtful'
import { Fetch } from './steps/Fetch'
import { Finish } from './steps/Finish'
import { OutlineLarge } from './steps/outlines/OutlineLarge'
import { Outlines } from './steps/outlines/Outlines'
import { Start } from './steps/Start'

export function App() {
  const [step, item, kind] = useRoute()
  if (step === 'fetch') return <Fetch />
  if (step === 'outlines') return item ? <OutlineLarge photo={item} /> : <Outlines />
  if (step === 'digits') return <Check key="digits" mode="digits" tab={item} />
  if (step === 'kinds') return <Check key="kinds" mode="kinds" tab={item} kind={kind} />
  if (step === 'doubtful') return <Doubtful />
  if (step === 'finish') return <Finish />
  return <Start />
}
