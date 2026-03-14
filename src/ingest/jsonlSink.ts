import { createJsonlExporter, type ExportRecord, type IJsonlExporter, type JsonlExporterOptions } from './jsonlExporter.js';

export interface IJsonlSinkAdapter {
  readonly write: (rec: ExportRecord) => void;
  readonly close: () => Promise<void>;
}

export const createJsonlSinkAdapter = (opts: JsonlExporterOptions): IJsonlSinkAdapter => {
  const exporter: IJsonlExporter = createJsonlExporter(opts);
  
  return {
    write: (rec) => exporter.enqueue(rec),
    close: () => exporter.close(),
  };
};