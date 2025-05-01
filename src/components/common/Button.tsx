// MyButton.tsx
import { extendVariants, Button } from "@heroui/react";

export const SoulsButton = extendVariants(Button, {
  variants: {
    // <- modify/add variants
    color: {
      // primary: "text-[#000] bg-gradient-to-t from-[#FFF2CF] via-[#FAD293]/[42.38%] to-[#F7B359]/[94.95%]",
      primary: "text-[#000] bg-gradient-to-t from-[#FFF2CF] via-[#FAD293] to-[#F7B359] rounded-full",
    },
    // size: {
    //   xs: "px-2 min-w-12 h-6 text-tiny gap-1 rounded-small",
    //   md: "px-4 min-w-20 h-10 text-small gap-2 rounded-small",
    //   xl: "px-8 min-w-28 h-14 text-large gap-4 rounded-medium",
    // },
  },
});