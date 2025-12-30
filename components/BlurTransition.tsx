import React from 'react';
import { motion } from 'framer-motion';

interface BlurTransitionProps {
  children: React.ReactNode;
  className?: string;
  key?: string | number;
}

export const BlurTransition: React.FC<BlurTransitionProps> = ({ children, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)', y: 10 }}
      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      exit={{ opacity: 0, filter: 'blur(10px)', y: -10 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
