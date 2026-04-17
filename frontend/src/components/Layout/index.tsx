import PlatformHeader from './PlatformHeader'
import '../../styles/global.css'

interface PlatformLayoutProps {
  children: React.ReactNode
}

export default function PlatformLayout({ children }: PlatformLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--omni-bg-layout)' }}>
      <PlatformHeader />
      <main style={{ minHeight: 'calc(100vh - var(--omni-header-height))' }}>
        {children}
      </main>
    </div>
  )
}
