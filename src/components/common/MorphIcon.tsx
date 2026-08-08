import { motion } from 'framer-motion';
import { Film, Play, Package, Archive, Monitor, Video, type LucideIcon } from 'lucide-react';

interface MorphIconProps {
  defaultIcon: LucideIcon;
  hoverIcon: LucideIcon;
  size?: number;
  className?: string;
  isHovered?: boolean;
}

export function MorphIcon({
  defaultIcon: DefaultIcon,
  hoverIcon: HoverIcon,
  size = 14,
  className = '',
  isHovered = false,
}: MorphIconProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <motion.div
        animate={{
          scale: isHovered ? 0.7 : 1,
          opacity: isHovered ? 0 : 1,
          rotate: isHovered ? 15 : 0,
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <DefaultIcon size={size} strokeWidth={1.75} />
      </motion.div>
      <motion.div
        animate={{
          scale: isHovered ? 1 : 0.7,
          opacity: isHovered ? 1 : 0,
          rotate: isHovered ? 0 : -15,
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <HoverIcon size={size} strokeWidth={1.75} />
      </motion.div>
    </div>
  );
}

// Dedicated minimal animated icons for ProjectHome actions
export function ImportVideoMorphIcon({ isHovered }: { isHovered?: boolean }) {
  return <MorphIcon defaultIcon={Film} hoverIcon={Play} size={14} isHovered={isHovered} />;
}

export function ImportPackageMorphIcon({ isHovered }: { isHovered?: boolean }) {
  return <MorphIcon defaultIcon={Package} hoverIcon={Archive} size={14} isHovered={isHovered} />;
}

export function NewRecordingMorphIcon({ isHovered }: { isHovered?: boolean }) {
  return <MorphIcon defaultIcon={Monitor} hoverIcon={Video} size={14} isHovered={isHovered} />;
}
