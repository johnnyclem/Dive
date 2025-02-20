import React from "react"
import PopupWindow from "../../components/PopupWindow"
import Tools from "./Tools"
import System from "./System"
import { useAtom } from "jotai"
import { overlaysAtom } from "../../atoms/overlayState"

const Overlay = () => {
  const [overlays] = useAtom(overlaysAtom)

  if (!overlays.length) return null

  return (
    <>
      {overlays.map((overlay, index) => {
        switch (overlay) {
          case 'Tools':
            return (
              <PopupWindow key={`tools-${index}`} isOverlay >
                <Tools />
              </PopupWindow>
            )
          case 'System':
            return (
              <PopupWindow key={`system-${index}`} isOverlay >
                <System />
              </PopupWindow>
            )
          default:
            return null
        }
      })}
    </>
  )
}

export default React.memo(Overlay)
