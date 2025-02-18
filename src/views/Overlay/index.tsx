import React from "react"
import PopupWindow from "../../components/PopupWindow"
import Tools from "./Tools"
import { useAtom } from "jotai"
import { overlaysAtom } from "../../atoms/overlayState"

const Overlay = () => {
  const [overlay] = useAtom(overlaysAtom)

  if (!overlay) return null

  return (
    <PopupWindow isOverlay>
      {overlay === 'Tools' && <Tools />}
    </PopupWindow>
  )
}

export default React.memo(Overlay)
