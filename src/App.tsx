import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { useApi } from './hooks/useApi'
import UploadPanel from './components/UploadPanel'
import CharacterPanel from './components/CharacterPanel'
import PlayerView from './components/PlayerView'

export default function App() {
  const { fetchVoices } = useApi()
  const stageValue = useAppStore((s) => s.stage)

  useEffect(() => {
    fetchVoices()
  }, [fetchVoices])

  if (stageValue === 'upload' || stageValue === 'analyzing') {
    return <UploadPanel />
  }
  if (stageValue === 'cast' || stageValue === 'generating') {
    return <CharacterPanel />
  }
  return <PlayerView />
}
