import {
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type Column,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { TableSkeleton } from '@/components/feedback/Skeletons'
import { Button } from '@/components/ui/button'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: {} as {
    label?: string
  },
})

export type AppColumnDef<T extends RowData> = ColumnDef<typeof features, T, unknown>

const DEFAULT_PAGE_SIZES = [10, 25, 50]

export type ServerPagination = {
  page: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
}

export type DataTableProps<T extends RowData> = {
  columns: AppColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  empty?: ReactNode
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  getRowId?: (row: T) => string
  initialPageSize?: number
  pageSizes?: number[]
  serverPagination?: ServerPagination
  toolbar?: ReactNode
  caption?: string
  className?: string
}

function columnLabel<T extends RowData>(column: Column<typeof features, T, unknown>) {
  if (column.columnDef.meta?.label) return column.columnDef.meta.label
  if (typeof column.columnDef.header === 'string') return column.columnDef.header
  return column.id
}

export function DataTable<T extends RowData>({
  columns,
  data,
  isLoading = false,
  empty,
  onRowClick,
  rowLabel,
  getRowId,
  initialPageSize = 10,
  pageSizes = DEFAULT_PAGE_SIZES,
  serverPagination,
  toolbar,
  caption,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const showSkeleton = useDelayedLoading(isLoading)
  const table = useTable({
    features,
    columns,
    data,
    state: serverPagination
      ? { sorting, pagination: { pageIndex: 0, pageSize: Math.max(data.length, 1) } }
      : { sorting },
    onSortingChange: setSorting,
    onPaginationChange: () => undefined,
    getRowId,
    initialState: { pagination: { pageIndex: 0, pageSize: initialPageSize } },
  })

  const rows = table.getRowModel().rows
  const columnCount = table.getLeafHeaders().length
  const { pageIndex, pageSize } = table.state.pagination
  const rowCount = table.getRowCount()
  const pageCount = Math.max(1, table.getPageCount())
  const firstRow = rows.length === 0 ? 0 : pageIndex * pageSize + 1
  const lastRow = pageIndex * pageSize + rows.length
  const currentPage = serverPagination?.page ?? pageIndex + 1
  const totalPages = serverPagination ? Math.max(1, serverPagination.pageCount) : pageCount

  function rowInteraction<TElement extends HTMLElement>(row: { original: T }) {
    if (!onRowClick) return {}
    return {
      onClick: () => onRowClick(row.original),
      'aria-label': rowLabel?.(row.original),
      tabIndex: 0,
      onKeyDown: (event: KeyboardEvent<TElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onRowClick(row.original)
        }
      },
    }
  }

  return (
    <section className={cn('overflow-hidden rounded-lg border border-hairline bg-card', className)}>
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline-in bg-panel px-3 py-2.5">
          {toolbar}
        </div>
      ) : null}

      {isLoading ? (
        showSkeleton ? (
          <TableSkeleton rows={6} columns={columnCount} />
        ) : (
          <div role="status" aria-label="Loading rows" className="px-3 py-6">
            <span className="sr-only">Loading</span>
          </div>
        )
      ) : rows.length === 0 ? (
        (empty ?? (
          <EmptyState
            title="Nothing to show yet"
            message="Adjust the filters, or add the first record."
          />
        ))
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              {caption ? <caption className="sr-only">{caption}</caption> : null}
              <TableHeader className="sticky top-0 z-10 bg-card">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      const sortable = header.column.getCanSort()
                      const sorted = header.column.getIsSorted()
                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          aria-sort={
                            sortable
                              ? sorted === 'asc'
                                ? 'ascending'
                                : sorted === 'desc'
                                  ? 'descending'
                                  : 'none'
                              : undefined
                          }
                          className="h-9 border-b border-hairline-in"
                        >
                          <span className="flex items-center gap-1">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                            {sortable ? (
                              <button
                                type="button"
                                onClick={header.column.getToggleSortingHandler()}
                                aria-label={`Sort by ${columnLabel(header.column)}`}
                                className={cn(
                                  'rounded-[3px] p-0.5 text-ink-faint transition-colors duration-150 ease-snap hover:bg-sunk hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none',
                                  sorted && 'text-ink',
                                )}
                              >
                                {sorted === 'asc' ? (
                                  <ArrowUp size={12} aria-hidden="true" />
                                ) : sorted === 'desc' ? (
                                  <ArrowDown size={12} aria-hidden="true" />
                                ) : (
                                  <ChevronsUpDown size={12} aria-hidden="true" />
                                )}
                              </button>
                            ) : null}
                          </span>
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn('h-10', onRowClick && 'cursor-pointer')}
                    {...rowInteraction<HTMLTableRowElement>(row)}
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="border-b border-hairline-in px-3 py-2 text-[12.5px] text-ink"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y divide-hairline-in md:hidden">
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn('space-y-2 p-3.5', onRowClick && 'cursor-pointer')}
                {...(onRowClick ? { role: 'button', ...rowInteraction<HTMLDivElement>(row) } : {})}
              >
                {row.getAllCells().map((cell) => (
                  <div key={cell.id} className="flex items-baseline justify-between gap-4">
                    <span className="text-[11px] text-ink-faint">{columnLabel(cell.column)}</span>
                    <span className="text-right text-[12.5px] text-ink">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline-in px-3 py-2">
            <p className="text-[11px] text-ink-soft" aria-live="polite">
              {serverPagination
                ? `${serverPagination.total} total`
                : `${firstRow}–${lastRow} of ${rowCount}`}
            </p>
            <div className="flex items-center gap-2">
              {serverPagination ? null : (
                <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                  Rows
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => table.setPageSize(Number(value))}
                  >
                    <SelectTrigger size="sm" className="w-16" aria-label="Rows per page">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pageSizes.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}
              <Button
                variant="outline"
                size="xs"
                onClick={() =>
                  serverPagination
                    ? serverPagination.onPageChange(currentPage - 1)
                    : table.previousPage()
                }
                disabled={serverPagination ? currentPage <= 1 : !table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <span className="text-[11px] text-ink-soft tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() =>
                  serverPagination
                    ? serverPagination.onPageChange(currentPage + 1)
                    : table.nextPage()
                }
                disabled={serverPagination ? currentPage >= totalPages : !table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
