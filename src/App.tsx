import { Layout } from './components/Layout'
import { useUiStore } from './store/uiStore'
import { Dashboard } from './pages/Dashboard'
// import { ShadowRuntime } from './pages/ShadowRuntime'
// import { TagDatabase } from './pages/TagDatabase'
// import { LogicEditor } from './pages/LogicEditor'
// import { Deploy } from './pages/Deploy'
// import { SettingsPage } from './pages/SettingsPage'

function App() {
  const active = useUiStore((s) => s.activeRoute)

  return (
    <Layout>
      {active === 'dashboard' && <Dashboard />}
      {/* {active === 'shadow' && <ShadowRuntime />}
      {active === 'tags' && <TagDatabase />}
      {active === 'logic' && <LogicEditor />}
      {active === 'deploy' && <Deploy />}
      {active === 'settings' && <SettingsPage />} */}
    </Layout>
  )
}

export default App
