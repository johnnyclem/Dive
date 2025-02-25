import React from "react"
import * as Portal from "@radix-ui/react-portal"
import { DismissableLayer } from "@radix-ui/react-dismissable-layer"
import { useAtom } from "jotai"
import { sidebarVisibleAtom } from "../atoms/sidebarState"

type TPopupWindowProps = {
  children: React.ReactNode
  zIndex?: number,
  onClickOutside?: () => void,
  overlay?: boolean
}

export default function PopupWindow({ children, zIndex = 100, onClickOutside = () => { }, overlay = false }: TPopupWindowProps) {
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
