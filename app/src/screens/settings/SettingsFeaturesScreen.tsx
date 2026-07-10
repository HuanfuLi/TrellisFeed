import { useTranslation } from 'react-i18next';
import { Header } from '../../components/ui/Header';
import { SUB_SCREEN_STYLE } from './SettingsShared';

export function SettingsFeaturesScreen() {
  const { t } = useTranslation();

  return (
    <div style={SUB_SCREEN_STYLE}>
      <Header title={t('settings.titles.features')} backTo="/settings" />
    </div>
  );
}
