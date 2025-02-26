import React from "react"
import * as Portal from "@radix-ui/react-portal"
import { DismissableLayer } from "@radix-ui/react-dismissable-layer"
import { useAtom } from "jotai"
import { sidebarVisibleAtom } from "../atoms/sidebarState"

type PopupWindowProps = {
  children: React.ReactNode
  zIndex?: number
  overlay?: boolean
  onClickOutside?: () => void
}

export default function PopupWindow({
  children,
  zIndex = 100,
  onClickOutside = () => {},
  overlay = false,
}: PopupWindowProps) {
  const [isSidebarVisible] = useAtom(sidebarVisibleAtom)
  const root = document.body

  return (
    <Portal.Root container={root}>
      <div className={`container-wrapper ${overlay ? "overlay" : ""} ${!isSidebarVisible ? "full-width" : ""}`} style={{ zIndex }}>
        <DismissableLayer onPointerDownOutside={onClickOutside}>
          {children}
        </DismissableLayer>
      </div>
    </Portal.Root>
  )
}
