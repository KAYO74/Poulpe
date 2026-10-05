import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { renderBelow } from '../photo/photoActions';
import { useEditor } from '../store';
import { Histogram } from './AdjustmentPanel';

/** Histogramme de l'image visible du plan de travail actif. */
export function HistogramPanel() {
  const t = useT();
  const { doc, activeArtboardId } = useEditor();
  const [data, setData] = useState<ImageData | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setData(renderBelow(320)), 250);
    return () => clearTimeout(id);
  }, [doc, activeArtboardId]);
  return (
    <div className="panel-body">
      <Histogram data={data} height={110} />
      <p className="note">{t('hist.luminance')} · R · V · B</p>
    </div>
  );
}
