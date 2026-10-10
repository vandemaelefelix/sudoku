import { DataTypes, Mat } from 'react-native-fast-opencv'

/** One Mat round trip through fast-opencv. True when the native module works (ADR-002). */
export function probeOpenCV(): boolean {
  const mat = Mat.create(2, 3, DataTypes.CV_8U)
  try {
    return mat.rows === 2 && mat.cols === 3
  } finally {
    mat.release()
  }
}
