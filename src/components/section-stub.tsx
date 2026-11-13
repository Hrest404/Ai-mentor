/** Временная заглушка раздела кабинета. Удаляется, когда раздел реализован. */
export function SectionStub({ title, stage }: { title: string; stage: number }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl">{title}</h1>
      <p className="text-muted">Раздел появится на этапе {stage}.</p>
    </div>
  );
}
