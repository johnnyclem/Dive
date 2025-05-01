import React from "react";
import "@tldraw/tldraw/tldraw.css";
import { Tabs, Tab } from "@heroui/react";
import type { Key } from "@react-types/shared";
import InfiniteCanvasComponent from "../../components/Canvas/InfiniteCanvasComponent";
import useCanvasStore from "../../components/Canvas/CanvasStore";
import CodeModal from "./CodeModal";
import { useUIStore } from "../../stores/uiStore";

interface SidePanelProps {
  chatId: string;
}

const SidePanel: React.FC<Omit<SidePanelProps, 'isOpen' | 'onClose'>> = ({ chatId }) => {
  const { isPanelOpen, selectedTab, setTab, closePanel } = useUIStore();

  return (
    <div
      className={`
        ${isPanelOpen ? 'w-1/2 translate-x-0 p-5 pointer-events-auto' : 'w-0 translate-x-full p-0 pointer-events-none'}
        flex-shrink-0 h-full bg-default-50
        shadow-[-2px_0_5px_rgba(0,0,0,0.1)] dark:shadow-[-2px_0_5px_rgba(255,255,255,0.1)]
        transition-all duration-300 ease-in-out rounded-tl-[15px] overflow-hidden
        flex flex-col relative z-20
      `}
    >
      <button
        className="absolute top-[10px] right-[10px] bg-transparent border-none text-2xl cursor-pointer z-10"
        onClick={closePanel}
      >
        ×
      </button>
      <Tabs
        aria-label="Side Panel Options"
        selectedKey={selectedTab}
        onSelectionChange={(key) => setTab(key as Key)}
        className="my-8 flex flex-col"
        classNames={{
          base: "",
          panel: "h-[calc(100%-40px)] p-0",
        }}
      >
        <Tab key="canvas" title="Canvas" className="">
          <NewCanvas chatId={chatId} />
        </Tab>
        <Tab key="code" title="Code">
          <CodeModal />
        </Tab>
      </Tabs>
    </div>
  );
};

const NewCanvas: React.FC<{ chatId: string }> = ({ chatId }) => {
  const contentData = useCanvasStore((state) => state.contentData);

  React.useEffect(() => {
    console.log(`Canvas mounted for chat ID: ${chatId || 'new chat'}`);
  }, [chatId]);

  return (
    <div className=" h-full">
      <InfiniteCanvasComponent data={contentData} />
    </div>
  );
};

export default SidePanel;