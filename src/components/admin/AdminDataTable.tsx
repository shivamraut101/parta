import Link from "next/link";

export type TableSortDirection = "asc" | "desc";
export type TableSortType = "string" | "number" | "currency" | "date" | "boolean";

export type TableColumn<T> = {
  key: keyof T;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  sortType?: TableSortType;
  className?: string;
};

type TableRow = Record<string, unknown>;

type TableSearchParamValue = string | string[] | undefined;
export type TableSearchParams = Record<string, TableSearchParamValue>;

type AdminDataTablePropsTyped<T extends TableRow> = {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: keyof T;
  emptyText?: string;
  basePath: string;
  searchParams?: TableSearchParams;
  defaultSort?: {
    key: keyof T;
    direction?: TableSortDirection;
  };
  defaultPageSize?: number;
  pageSizeOptions?: number[];
};

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function normalizeParam(value: TableSearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function toComparable(value: unknown, sortType: TableSortType): string | number | null {
  if (value === null || value === undefined) return null;

  if (sortType === "number" || sortType === "currency") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (sortType === "date") {
    const parsed = new Date(String(value)).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (sortType === "boolean") {
    return value ? 1 : 0;
  }

  return String(value).toLocaleLowerCase("en-IN");
}

function compareValues(
  left: unknown,
  right: unknown,
  sortType: TableSortType,
): number {
  const a = toComparable(left, sortType);
  const b = toComparable(right, sortType);

  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b), "en-IN", {
    sensitivity: "base",
    numeric: true,
  });
}

function withQuery(basePath: string, current: TableSearchParams | undefined, updates: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  Object.entries(current ?? {}).forEach(([key, raw]) => {
    const normalized = normalizeParam(raw);
    if (!normalized) return;
    params.set(key, normalized);
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (!value) {
      params.delete(key);
      return;
    }
    params.set(key, value);
  });

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function AdminDataTable<T extends TableRow>({
  columns,
  data,
  rowKey,
  emptyText = "No data found",
  basePath,
  searchParams,
  defaultSort,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: AdminDataTablePropsTyped<T>) {
  const sortableColumns = columns.filter((column) => column.sortable);
  const requestedSortKey = normalizeParam(searchParams?.sort);
  const defaultSortKey = defaultSort ? String(defaultSort.key) : sortableColumns[0] ? String(sortableColumns[0].key) : undefined;

  const sortKey =
    requestedSortKey && sortableColumns.some((column) => String(column.key) === requestedSortKey)
      ? requestedSortKey
      : defaultSortKey;

  const requestedSortDirection = normalizeParam(searchParams?.dir);
  const sortDirection: TableSortDirection =
    requestedSortDirection === "desc"
      ? "desc"
      : defaultSort?.direction === "desc"
        ? "desc"
        : "asc";

  const resolvedPageSizeOptions = Array.from(
    new Set([
      ...pageSizeOptions.filter((size) => Number.isFinite(size) && size > 0),
      defaultPageSize,
    ]),
  ).sort((a, b) => a - b);

  const requestedPageSize = parsePositiveInt(normalizeParam(searchParams?.pageSize));
  const pageSize =
    requestedPageSize && resolvedPageSizeOptions.includes(requestedPageSize)
      ? requestedPageSize
      : defaultPageSize;

  const sortedData = sortKey
    ? data
        .map((row, index) => ({ row, index }))
        .sort((left, right) => {
          const sortColumn = columns.find((column) => String(column.key) === sortKey);
          const sortType = sortColumn?.sortType ?? "string";
          const result = compareValues(
            left.row[sortKey as keyof T],
            right.row[sortKey as keyof T],
            sortType,
          );

          if (result === 0) {
            return left.index - right.index;
          }

          return sortDirection === "asc" ? result : -result;
        })
        .map((entry) => entry.row)
    : data;

  const totalRows = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const requestedPage = parsePositiveInt(normalizeParam(searchParams?.page)) ?? 1;
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const displayData = sortedData.slice(startIndex, endIndex);

  const firstRowNumber = totalRows === 0 ? 0 : startIndex + 1;
  const lastRowNumber = Math.min(endIndex, totalRows);

  const pageWindowStart = Math.max(1, currentPage - 2);
  const pageWindowEnd = Math.min(totalPages, pageWindowStart + 4);
  const pageNumbers = Array.from(
    { length: pageWindowEnd - pageWindowStart + 1 },
    (_, index) => pageWindowStart + index,
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr>
            {columns.map((col) => {
              const columnKey = String(col.key);
              const isSortedColumn = sortKey === columnKey;
              const nextDirection: TableSortDirection =
                isSortedColumn && sortDirection === "asc" ? "desc" : "asc";

              return (
              <th
                key={columnKey}
                className={`px-6 py-3 text-left font-semibold text-stone-700 ${col.className || ""}`}
              >
                {col.sortable ? (
                  <Link
                    href={withQuery(basePath, searchParams, {
                      sort: columnKey,
                      dir: nextDirection,
                      page: "1",
                      pageSize: String(pageSize),
                    })}
                    className="inline-flex items-center gap-2 text-stone-700 hover:text-teal-700"
                  >
                    <span>{col.label}</span>
                    <span className="text-xs text-stone-500">
                      {isSortedColumn ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </Link>
                ) : (
                  <span>{col.label}</span>
                )}
              </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-stone-500">
                {emptyText}
              </td>
            </tr>
          ) : (
            displayData.map((row) => (
              <tr
                key={String(row[rowKey])}
                className="border-b border-stone-100 transition-colors hover:bg-stone-50"
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className={`px-6 py-4 text-stone-900 ${col.className || ""}`}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-stone-50/70 px-4 py-3 text-xs text-stone-600">
        <p>
          Showing {firstRowNumber}-{lastRowNumber} of {totalRows}
        </p>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-stone-500">Rows:</span>
          {resolvedPageSizeOptions.map((size) => {
            const active = pageSize === size;
            return active ? (
              <span
                key={size}
                className="rounded-md border border-teal-300 bg-teal-50 px-2 py-1 font-semibold text-teal-700"
              >
                {size}
              </span>
            ) : (
              <Link
                key={size}
                href={withQuery(basePath, searchParams, {
                  sort: sortKey,
                  dir: sortDirection,
                  page: "1",
                  pageSize: String(size),
                })}
                className="rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-700 hover:border-teal-300 hover:text-teal-700"
              >
                {size}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          {currentPage > 1 ? (
            <Link
              href={withQuery(basePath, searchParams, {
                sort: sortKey,
                dir: sortDirection,
                page: String(currentPage - 1),
                pageSize: String(pageSize),
              })}
              className="rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-700 hover:border-teal-300 hover:text-teal-700"
            >
              Prev
            </Link>
          ) : (
            <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-1 text-stone-400">Prev</span>
          )}

          {pageNumbers.map((pageNumber) =>
            pageNumber === currentPage ? (
              <span
                key={pageNumber}
                className="rounded-md border border-teal-300 bg-teal-50 px-2 py-1 font-semibold text-teal-700"
              >
                {pageNumber}
              </span>
            ) : (
              <Link
                key={pageNumber}
                href={withQuery(basePath, searchParams, {
                  sort: sortKey,
                  dir: sortDirection,
                  page: String(pageNumber),
                  pageSize: String(pageSize),
                })}
                className="rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-700 hover:border-teal-300 hover:text-teal-700"
              >
                {pageNumber}
              </Link>
            ),
          )}

          {currentPage < totalPages ? (
            <Link
              href={withQuery(basePath, searchParams, {
                sort: sortKey,
                dir: sortDirection,
                page: String(currentPage + 1),
                pageSize: String(pageSize),
              })}
              className="rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-700 hover:border-teal-300 hover:text-teal-700"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-1 text-stone-400">Next</span>
          )}
        </div>
      </div>
    </div>
  );
}
