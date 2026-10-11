import { loadTensorflowModel } from 'react-native-fast-tflite'
import { loadClassifier } from './model'

describe('loadClassifier', () => {
  it('loads the bundled model on the CPU and checks it against the manifest', async () => {
    jest.mocked(loadTensorflowModel).mockResolvedValue({
      outputs: [{ shape: [81, 10] }, { shape: [81, 4] }],
      runSync: jest.fn(),
    } as never)
    const classifier = await loadClassifier()
    expect(loadTensorflowModel).toHaveBeenCalledWith(1, [])
    expect(classifier.manifest.contract.startsWith('1.')).toBe(true)
  })
})
