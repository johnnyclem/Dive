import useAppearanceStore from 'stores/useAppearanceStore';

export default function useMermaid() {
  const theme = useAppearanceStore((state) => state.theme);
  
  // Initialize once with proper configuration
  const initializeMermaid = async () => {
    const mermaid = await import('mermaid');
    mermaid.default.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    });
    return mermaid.default;
  };

  return {
    async renderMermaid(container?: HTMLElement) {
      try {
        const mermaid = await initializeMermaid();
        await mermaid.run({
          querySelector: container
            ? container.querySelector.bind(container)
            : '.mermaid',
        });
      } catch (error) {
        console.error('Mermaid rendering error:', error);
      }
    },
  };
}
