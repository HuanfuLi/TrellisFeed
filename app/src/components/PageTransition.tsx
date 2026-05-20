import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

const variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};

export function PageTransition({ children }: PageTransitionProps) {
  // Key the motion element on the pathname so React remounts it when navigating
  // between two sub-screens (e.g. Saved → Podcast). Without the key, React
  // reuses the same PageTransition instance across sibling sub-screen routes and
  // only swaps children, so `initial → animate` never replays and the new screen
  // appears with no transition. The sub-screen overlay container in App.tsx only
  // plays its own enter animation once (on first overlay mount), so the
  // route-change animation must come from here.
  const { pathname } = useLocation();
  return (
    <motion.div
      key={pathname}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
