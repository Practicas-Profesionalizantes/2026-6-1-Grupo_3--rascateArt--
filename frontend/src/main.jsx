import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import { AuthProvider } from './context/AuthContext'
import { ShopProvider } from './context/ShopContext'
import App from './App'
import './styles.css'

const antTheme = {
  token: {
    colorPrimary: '#a3335f',
    colorInfo: '#a3335f',
    colorLink: '#a3335f',
    colorText: '#211c1e',
    colorTextSecondary: '#6b6265',
    colorBgLayout: '#f7f3ef',
    colorBgContainer: '#ffffff',
    colorBorder: '#e2dad4',
    colorBorderSecondary: '#ece6e1',
    borderRadius: 6,
    borderRadiusLG: 8,
    controlHeight: 44,
    controlHeightLG: 48,
    controlHeightSM: 32,
    fontFamily: "'Jost', system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: 16,
    fontSizeSM: 14,
    boxShadow: '0 4px 24px rgba(33, 28, 30, 0.06)',
    boxShadowSecondary: '0 4px 24px rgba(33, 28, 30, 0.06)',
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 500 },
    Layout: { bodyBg: '#f7f3ef', siderBg: '#ffffff' },
    Table: { headerBg: '#faf7f4', cellFontSize: 15 },
    Menu: { itemBg: 'transparent', itemSelectedBg: '#f6e9ee', itemSelectedColor: '#a3335f' },
  },
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider theme={antTheme} locale={esES}>
      <AntApp>
        <AuthProvider>
          <ShopProvider>
            <App />
          </ShopProvider>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>
)
