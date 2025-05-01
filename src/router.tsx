import { createHashRouter } from "react-router-dom"
import Layout from "./views/Layout"
import Browser from "./views/Browser"
import Chat from "./views/Chat"
import Welcome from "./views/Welcome"
import Setup from "./views/Setup"
import { KnowledgeBase } from "./components/KnowledgeBase"
import ToolsPage from "./pages/ToolsPage"
import PersonasPage from "./pages/PersonasPage"
import StoragePage from "./pages/StoragePage"
import SettingsPage from "./pages/SettingsPage"
import ModelSettingsPage from "./pages/ModelSettingsPage"
import SystemSettingsPage from "./pages/SystemSettingsPage"
import Wallet from "./views/Wallet"
import WorkflowsPage from "./pages/WorkflowsPage"
import CoBrowserView from './components/CoBrowser/CoBrowserView'

export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Welcome />
      },
      {
        path: "browser",
        element: <Browser />
      },
      {
        path: "wallet",
        element: <Wallet />
      },
      {
        path: "chat",
        element: <Chat />
      },
      {
        path: "chat/:chatId",
        element: <Chat />
      },
      {
        path: "setup",
        element: <Setup />
      },
      {
        path: "knowledge-base",
        element: <KnowledgeBase />
      },
      {
        path: "tools",
        element: <ToolsPage />
      },
      {
        path: "personas",
        element: <PersonasPage />
      },
      {
        path: "storage",
        element: <StoragePage />
      },
      {
        path: "settings",
        element: <SettingsPage />,
        children: [
          {
            path: "model",
            element: <ModelSettingsPage />
          },
          {
            path: "system",
            element: <SystemSettingsPage />
          }
        ]
      },
      {
        path: "workflows",
        element: <WorkflowsPage />
      }
    ]
  }
], {
  future: {
    v7_relativeSplatPath: true,
  },
})
