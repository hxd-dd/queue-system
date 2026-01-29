import { useState } from 'react'
import App from './App'
import DesignTest from './DesignTest'

/**
 * 测试入口：可以在原应用和设计测试组件之间切换
 */
export default function TestEntry() {
  const [showTest, setShowTest] = useState(true) // 默认显示测试组件

  return (
    <>
      {/* 切换按钮 */}
      <div style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        gap: '8px',
      }}>
        <button
          onClick={() => setShowTest(true)}
          style={{
            padding: '8px 16px',
            background: showTest ? '#00f5ff' : 'rgba(255, 255, 255, 0.1)',
            color: showTest ? '#000' : '#fff',
            border: '1px solid #00f5ff',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'system-ui',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          设计测试
        </button>
        <button
          onClick={() => setShowTest(false)}
          style={{
            padding: '8px 16px',
            background: !showTest ? '#00f5ff' : 'rgba(255, 255, 255, 0.1)',
            color: !showTest ? '#000' : '#fff',
            border: '1px solid #00f5ff',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'system-ui',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          原应用
        </button>
      </div>

      {showTest ? <DesignTest /> : <App />}
    </>
  )
}
