import { useRef, useState } from 'react';
import { LevaButton } from '../LevaButton/LevaButton';
import { exportPreset, importPreset, BUILT_IN_PRESETS } from '../../utils/presetUtils';
import { SHOWCASE_DEMOS } from '../../utils/showcaseAnimations';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import styles from './PresetControls.module.scss';
import { type useLevaControls } from '../../Controls';

export interface PresetControlsProps {
  controls: ReturnType<typeof useLevaControls>['controls'];
  controlsAPI: ReturnType<typeof useLevaControls>['controlsAPI'];
  lang: ReturnType<typeof useLevaControls>['lang'];
  activeShowcase: string | null;
  onStartShowcase: (id: string) => void;
  onStopShowcase: () => void;
}

export const PresetControls = ({ controls, controlsAPI, lang, activeShowcase, onStartShowcase, onStopShowcase }: PresetControlsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const handleExport = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    exportPreset(controls, `liquid-glass-${timestamp}.json`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const preset = await importPreset(file);
      console.log('Preset loaded:', preset);

      if (typeof controlsAPI === 'function') {
        try {
          controlsAPI(preset.controls);
        } catch (err) {
          console.error(`Error setting preset values with leva:`, err);
        }
      } else {
        console.error('controlsAPI is not a function. Import may fail.', controlsAPI);
      }
      setActivePresetId(null);
      alert(lang['editor.importSuccessMessage']);
    } catch (err) {
      alert(lang['editor.importFailedMessage'](err instanceof Error ? err.message : 'Unknown error'));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = BUILT_IN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    if (typeof controlsAPI === 'function') {
      try {
        controlsAPI(preset.values);
        setActivePresetId(presetId);
      } catch (err) {
        console.error('Error applying built-in preset:', err);
      }
    }
  };

  const getPresetName = (presetId: string): string => {
    const key = `editor.preset.${presetId}` as keyof typeof lang;
    return (lang[key] as string) || presetId;
  };

  return (
    <div>
      <div className={styles.presetControls}>
        <LevaButton onClick={handleExport} title="Export current preset">
          <FileDownloadOutlinedIcon style={{ fontSize: '14px', marginRight: '4px' }} />
          {lang['editor.export'] || 'Export'}
        </LevaButton>

        <LevaButton onClick={handleImportClick} title="Import preset from file">
          <FileUploadOutlinedIcon style={{ fontSize: '14px', marginRight: '4px' }} />
          {lang['editor.import'] || 'Import'}
        </LevaButton>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      <div className={styles.presetSection}>
        <div className={styles.presetLabel}>
          {(lang as Record<string, unknown>)['editor.builtInPresets'] as string || 'Glass Presets'}
        </div>
        <div className={styles.presetGrid}>
          {BUILT_IN_PRESETS.map((preset) => (
            <LevaButton
              key={preset.id}
              active={activePresetId === preset.id}
              onClick={() => handlePresetSelect(preset.id)}
              title={getPresetName(preset.id)}
            >
              {getPresetName(preset.id)}
            </LevaButton>
          ))}
        </div>
      </div>

      <div className={styles.presetSection}>
        <div className={styles.presetLabel}>
          {(lang as Record<string, unknown>)['editor.showcase'] as string || 'Showcase'}
        </div>
        <div className={styles.presetGrid}>
          {SHOWCASE_DEMOS.map((demo) => {
            const isActive = activeShowcase === demo.id;
            const labelKey = `editor.showcase.${demo.id}` as keyof typeof lang;
            const label = (lang[labelKey] as string) || demo.id;
            return (
              <LevaButton
                key={demo.id}
                active={isActive}
                onClick={() => {
                  if (isActive) {
                    onStopShowcase();
                  } else {
                    onStartShowcase(demo.id);
                  }
                }}
                title={label}
                className={isActive ? styles.showcaseActive : undefined}
              >
                {label}
              </LevaButton>
            );
          })}
        </div>
      </div>
    </div>
  );
};
