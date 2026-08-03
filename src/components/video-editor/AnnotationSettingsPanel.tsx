import {useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Type, Image as ImageIcon, Upload, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import Block from '@uiw/react-color-block';
import type { AnnotationRegion, AnnotationType, ArrowDirection, FigureData } from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getArrowComponent } from "./ArrowSvgs";

interface AnnotationSettingsPanelProps {
  annotation: AnnotationRegion;
  onContentChange: (content: string) => void;
  onTypeChange: (type: AnnotationType) => void;
  onStyleChange: (style: Partial<AnnotationRegion['style']>) => void;
  onFigureDataChange?: (figureData: FigureData) => void;
  onDelete: () => void;
}

const FONT_FAMILIES = [
  { value: 'system-ui, -apple-system, sans-serif', label: 'Classic' },
  { value: 'Georgia, serif', label: 'Editor' },
  { value: 'Impact, Arial Black, sans-serif', label: 'Strong' },
  { value: 'Courier New, monospace', label: 'Typewriter' },
  { value: 'Brush Script MT, cursive', label: 'Deco' },
  { value: 'Arial, sans-serif', label: 'Simple' },
  { value: 'Verdana, sans-serif', label: 'Modern' },
  { value: 'Trebuchet MS, sans-serif', label: 'Clean' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 128];

export function AnnotationSettingsPanel({
  annotation,
  onContentChange,
  onTypeChange,
  onStyleChange,
  onFigureDataChange,
  onDelete,
}: AnnotationSettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPalette = [
    '#FF0000', // Red
    '#FFD700', // Yellow/Gold
    '#00FF00', // Green
    '#FFFFFF', // White
    '#0000FF', // Blue
    '#FF6B00', // Orange
    '#9B59B6', // Purple
    '#E91E63', // Pink
    '#00BCD4', // Cyan
    '#FF5722', // Deep Orange
    '#8BC34A', // Light Green
    '#FFC107', // Amber
    '#34B27B', // Brand Green
    '#000000', // Black
    '#607D8B', // Blue Grey
    '#795548', // Brown
  ];



  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please upload a JPG, PNG, GIF, or WebP image file.',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        onContentChange(dataUrl);
        toast.success('Image uploaded successfully!');
      }
    };

    reader.onerror = () => {
      toast.error('Failed to upload image', {
        description: 'There was an error reading the file.',
      });
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <section className="px-4 py-3">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--ui-text-primary)]">Annotation Settings</span>
          <span className="rounded-full bg-[#0D99FF]/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#0D99FF]">
            Active
          </span>
        </div>
        
        {/* Type Selector */}
        <Tabs value={annotation.type} onValueChange={(value) => onTypeChange(value as AnnotationType)}>
          <TabsList className="mb-3 grid h-7 w-full grid-cols-3 rounded-[5px] border-0 bg-[var(--ui-control)] p-0.5">
            <TabsTrigger value="text" className="h-6 self-center gap-1.5 rounded-[4px] py-0 text-[12px] text-[var(--ui-text-secondary)] shadow-none transition-colors data-[state=active]:bg-[var(--ui-segment-selected)] data-[state=active]:text-[var(--ui-segment-selected-text)] data-[state=active]:shadow-none">
              <Type className="h-3.5 w-3.5" />
              Text
            </TabsTrigger>
            <TabsTrigger value="image" className="h-6 self-center gap-1.5 rounded-[4px] py-0 text-[12px] text-[var(--ui-text-secondary)] shadow-none transition-colors data-[state=active]:bg-[var(--ui-segment-selected)] data-[state=active]:text-[var(--ui-segment-selected-text)] data-[state=active]:shadow-none">
              <ImageIcon className="h-3.5 w-3.5" />
              Image
            </TabsTrigger>
            <TabsTrigger value="figure" className="h-6 self-center gap-1.5 rounded-[4px] py-0 text-[12px] text-[var(--ui-text-secondary)] shadow-none transition-colors data-[state=active]:bg-[var(--ui-segment-selected)] data-[state=active]:text-[var(--ui-segment-selected-text)] data-[state=active]:shadow-none">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Arrow
            </TabsTrigger>
          </TabsList>

          {/* Text Content */}
          <TabsContent value="text" className="mt-0 space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-text-secondary)]">Text Content</label>
              <textarea
                value={annotation.textContent || annotation.content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder="Enter your text..."
                rows={4}
                className="w-full resize-none rounded-[5px] border-0 bg-[var(--ui-control)] px-2.5 py-2 text-[12px] text-[var(--ui-text-secondary)] outline-none placeholder:text-[var(--ui-text-tertiary)] focus:ring-1 focus:ring-[#0D99FF]"
              />
            </div>

            {/* Styling Controls */}
            <div className="space-y-3">
              {/* Font Family & Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-text-secondary)]">Font Style</label>
                  <Select 
                    value={annotation.style.fontFamily} 
                    onValueChange={(value) => onStyleChange({ fontFamily: value })}
                  >
                    <SelectTrigger className="h-7 w-full rounded-[5px] border-0 bg-[var(--ui-control)] text-[12px] text-[var(--ui-text-secondary)] shadow-none">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent className="toscreen-dropdown-menu border-0 text-[12px] shadow-lg">
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-text-secondary)]">Size</label>
                  <Select 
                    value={annotation.style.fontSize.toString()} 
                    onValueChange={(value) => onStyleChange({ fontSize: parseInt(value) })}
                  >
                    <SelectTrigger className="h-7 w-full rounded-[5px] border-0 bg-[var(--ui-control)] text-[12px] text-[var(--ui-text-secondary)] shadow-none">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent className="toscreen-dropdown-menu max-h-[200px] border-0 text-[12px] shadow-lg">
                      {FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Formatting Toggles */}
              <div className="flex items-center justify-between gap-2">
                <ToggleGroup type="multiple" className="h-7 justify-start rounded-[5px] border-0 bg-[var(--ui-control)] p-0.5">
                  <ToggleGroupItem 
                    value="bold" 
                    aria-label="Toggle bold"
                    data-state={annotation.style.fontWeight === 'bold' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ fontWeight: annotation.style.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className="h-6 w-7 rounded-[4px] p-0 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=on]:bg-[var(--ui-segment-selected)] data-[state=on]:text-[#0D99FF]"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="italic" 
                    aria-label="Toggle italic"
                    data-state={annotation.style.fontStyle === 'italic' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ fontStyle: annotation.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className="h-6 w-7 rounded-[4px] p-0 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=on]:bg-[var(--ui-segment-selected)] data-[state=on]:text-[#0D99FF]"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="underline" 
                    aria-label="Toggle underline"
                    data-state={annotation.style.textDecoration === 'underline' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ textDecoration: annotation.style.textDecoration === 'underline' ? 'none' : 'underline' })}
                    className="h-6 w-7 rounded-[4px] p-0 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=on]:bg-[var(--ui-segment-selected)] data-[state=on]:text-[#0D99FF]"
                  >
                    <Underline className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>

                <ToggleGroup type="single" value={annotation.style.textAlign} className="h-7 justify-start rounded-[5px] border-0 bg-[var(--ui-control)] p-0.5">
                  <ToggleGroupItem 
                    value="left" 
                    aria-label="Align left"
                    onClick={() => onStyleChange({ textAlign: 'left' })}
                    className="h-6 w-7 rounded-[4px] p-0 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=on]:bg-[var(--ui-segment-selected)] data-[state=on]:text-[#0D99FF]"
                  >
                    <AlignLeft className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="center" 
                    aria-label="Align center"
                    onClick={() => onStyleChange({ textAlign: 'center' })}
                    className="h-6 w-7 rounded-[4px] p-0 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=on]:bg-[var(--ui-segment-selected)] data-[state=on]:text-[#0D99FF]"
                  >
                    <AlignCenter className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="right" 
                    aria-label="Align right"
                    onClick={() => onStyleChange({ textAlign: 'right' })}
                    className="h-6 w-7 rounded-[4px] p-0 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)] focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=on]:bg-[var(--ui-segment-selected)] data-[state=on]:text-[#0D99FF]"
                  >
                    <AlignRight className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-text-secondary)]">Text Color</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="h-7 w-full justify-start gap-2 rounded-[5px] border-0 bg-[var(--ui-control)] px-2 shadow-none hover:bg-[var(--ui-control-hover)]"
                      >
                        <div 
                          className="h-4 w-4 rounded-full border border-[var(--ui-border)]"
                          style={{ backgroundColor: annotation.style.color }}
                        />
                        <span className="flex-1 truncate text-left text-[12px] text-[var(--ui-text-secondary)]">
                          {annotation.style.color}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="toscreen-dropdown-menu w-[260px] rounded-[8px] border-0 p-3 shadow-xl">
                      <Block
                        color={annotation.style.color}
                        colors={colorPalette}
                        onChange={(color) => {
                          onStyleChange({ color: color.hex });
                        }}
                        style={{
                          borderRadius: '8px',
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-text-secondary)]">Background</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="h-7 w-full justify-start gap-2 rounded-[5px] border-0 bg-[var(--ui-control)] px-2 shadow-none hover:bg-[var(--ui-control-hover)]"
                      >
                        <div 
                          className="relative h-4 w-4 overflow-hidden rounded-full border border-[var(--ui-border)]"
                        >
                          <div className="absolute inset-0 checkerboard-bg opacity-50" />
                          <div 
                            className="absolute inset-0"
                            style={{ backgroundColor: annotation.style.backgroundColor }}
                          />
                        </div>
                        <span className="flex-1 truncate text-left text-[12px] text-[var(--ui-text-secondary)]">
                          {annotation.style.backgroundColor === 'transparent' ? 'None' : 'Color'}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="toscreen-dropdown-menu w-[260px] rounded-[8px] border-0 p-3 shadow-xl">
                      <Block
                        color={annotation.style.backgroundColor === 'transparent' ? '#000000' : annotation.style.backgroundColor}
                        colors={colorPalette}
                        onChange={(color) => {
                          onStyleChange({ backgroundColor: color.hex });
                        }}
                        style={{
                          borderRadius: '8px',
                        }}
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 h-7 w-full text-[12px] text-[var(--ui-text-secondary)] hover:bg-[var(--ui-control-hover)]"
                        onClick={() => {
                          onStyleChange({ backgroundColor: 'transparent' });
                        }}
                      >
                        Clear Background
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>


          </TabsContent>

          {/* Image Upload */}
          <TabsContent value="image" className="mt-0 space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept=".jpg,.jpeg,.png,.gif,.webp,image/*"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="h-7 w-full justify-start gap-2 rounded-[5px] border-0 bg-[var(--ui-control)] px-2.5 text-[12px] text-[var(--ui-text-secondary)] shadow-none transition-colors hover:bg-[var(--ui-control-hover)]"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Image
            </Button>

            {annotation.content && annotation.content.startsWith('data:image') && (
              <div className="overflow-hidden rounded-[5px] bg-[var(--ui-control)] p-2">
                <img
                  src={annotation.content}
                  alt="Uploaded annotation"
                  className="h-auto w-full rounded-[4px]"
                />
              </div>
            )}

            <p className="text-center text-[11px] leading-relaxed text-[var(--ui-text-tertiary)]">
              Supported formats: JPG, PNG, GIF, WebP
            </p>
          </TabsContent>

          <TabsContent value="figure" className="mt-0 space-y-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-text-secondary)]">Arrow Direction</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  'up', 'down', 'left', 'right',
                  'up-right', 'up-left', 'down-right', 'down-left',
                ] as ArrowDirection[]).map((direction) => {
                  const ArrowComponent = getArrowComponent(direction);
                  return (
                    <button
                      key={direction}
                      onClick={() => {
                        const newFigureData: FigureData = {
                          ...annotation.figureData!,
                          arrowDirection: direction,
                        };
                        onFigureDataChange?.(newFigureData);
                      }}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-[5px] border border-transparent bg-[var(--ui-control)] p-2 transition-colors",
                        annotation.figureData?.arrowDirection === direction
                          ? "bg-[#0D99FF]/8 ring-1 ring-[#0D99FF]"
                          : "hover:bg-[var(--ui-control-hover)]"
                      )}
                    >
                      <ArrowComponent
                        color={annotation.figureData?.arrowDirection === direction ? "#0D99FF" : "#7B8390"}
                        strokeWidth={2}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-text-secondary)]">
                Stroke Width: {annotation.figureData?.strokeWidth || 4}px
              </label>
              <Slider
                value={[annotation.figureData?.strokeWidth || 4]}
                onValueChange={([value]) => {
                  const newFigureData: FigureData = {
                    ...annotation.figureData!,
                    strokeWidth: value,
                  };
                  onFigureDataChange?.(newFigureData);
                }}
                min={1}
                max={6}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--ui-text-secondary)]">Arrow Color</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-7 w-full justify-start gap-2 rounded-[5px] border-0 bg-[var(--ui-control)] px-2 shadow-none hover:bg-[var(--ui-control-hover)]"
                  >
                    <div 
                      className="h-4 w-4 rounded-full border border-[var(--ui-border)]"
                      style={{ backgroundColor: annotation.figureData?.color || '#34B27B' }}
                    />
                    <span className="flex-1 truncate text-left text-[12px] text-[var(--ui-text-secondary)]">
                      {annotation.figureData?.color || '#34B27B'}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="toscreen-dropdown-menu w-[260px] rounded-[8px] border-0 p-3 shadow-xl">
                  <Block
                    color={annotation.figureData?.color || '#34B27B'}
                    colors={colorPalette}
                    onChange={(color) => {
                      const newFigureData: FigureData = {
                        ...annotation.figureData!,
                        color: color.hex,
                      };
                      onFigureDataChange?.(newFigureData);
                    }}
                    style={{
                      borderRadius: '8px',
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </TabsContent>
        </Tabs>

        <Button
          onClick={onDelete}
          variant="destructive"
          size="sm"
          className="mt-3 h-7 w-full justify-start gap-2 rounded-[5px] border-0 bg-red-500/8 px-2.5 text-[12px] text-red-500 shadow-none transition-colors hover:bg-red-500/12"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Annotation
        </Button>

        <div className="mt-4 border-t border-[var(--ui-border)] pt-3">
          <div className="mb-2 flex items-center gap-2 text-[var(--ui-text-primary)]">
            <Info className="w-3.5 h-3.5" />
            <span className="text-[12px] font-medium">Shortcuts & Tips</span>
          </div>
          <ul className="list-disc space-y-1.5 pl-3 text-[11px] leading-relaxed text-[var(--ui-text-tertiary)]">
            <li>Move playhead to overlapping annotation section and select an item.</li>
            <li>Use <kbd className="rounded bg-[var(--ui-control)] px-1 py-0.5 font-mono text-[var(--ui-text-secondary)]">Tab</kbd> to cycle through overlapping items.</li>
            <li>Use <kbd className="rounded bg-[var(--ui-control)] px-1 py-0.5 font-mono text-[var(--ui-text-secondary)]">Shift+Tab</kbd> to cycle backwards.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
