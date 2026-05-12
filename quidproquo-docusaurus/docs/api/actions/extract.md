---
sidebar_position: 23
---

# Extract Actions

Extract structured data from documents stored in a storage drive.

## Overview

Extract actions use OCR and document intelligence (backed by AWS Textract on AWS deployments) to pull structured information from document files. The current implementation focuses on expense/receipt documents, returning a normalized `ExtractedExpenseDocument` with line items, merchant information, totals, and raw OCR text.

## Available Actions

### askExtractExpense

Extract expense data from a document file stored in a storage drive.

#### Signature

```typescript
function* askExtractExpense(
  storageDriveName: string,
  filePath: string
): ExtractExpenseActionRequester
```

#### Parameters

- **storageDriveName** (`string`): Name of the storage drive where the document is stored
- **filePath** (`string`): Path to the document file within the storage drive (PDF or image)

#### Returns

Returns an `ExtractedExpenseDocument`:

```typescript
interface ExtractedExpenseDocument {
  metadata: {
    merchantName?: string;
    merchantAddress?: string;
    date?: string;
    currency?: string;
    paymentMethod?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
  };
  lineItems: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
  }>;
  rawText: string;
  source: {
    storageDrive: string;
    filePath: string;
    textractJobId: string;
  };
  _raw: unknown;
}
```

#### Example

```typescript
import { askExtractExpense } from 'quidproquo-webserver';

function* processExpenseReceipt(filePath: string) {
  const expense = yield* askExtractExpense('receipts-drive', filePath);

  return {
    merchant: expense.metadata.merchantName,
    total: expense.metadata.total,
    date: expense.metadata.date,
    lineItems: expense.lineItems,
  };
}
```

## Error Types

The following error types may be thrown by `askExtractExpense`:

- **FileNotFound** — The specified file does not exist in the storage drive
- **UnsupportedFormat** — The file format is not supported for extraction
- **InvalidParameter** — One or more parameters are invalid
- **RateLimited** — The extraction service is rate limiting requests
- **InvalidStorageClass** — The file's storage class is incompatible with extraction
- **AccessDenied** — Insufficient permissions to access the file or extraction service

## Usage Patterns

### Upload and Extract in a Single Flow

```typescript
function* handleReceiptUpload(fileBuffer: Buffer, fileName: string) {
  // Upload to storage
  yield* askFileWrite('receipts-drive', `uploads/${fileName}`, fileBuffer);

  // Extract expense data
  const expenseData = yield* askExtractExpense(
    'receipts-drive',
    `uploads/${fileName}`
  );

  // Store structured result
  yield* askKeyValueStoreUpsert('expenses', {
    id: yield* askNewGuid(),
    fileName,
    merchant: expenseData.metadata.merchantName,
    amount: expenseData.metadata.total,
    currency: expenseData.metadata.currency,
    date: expenseData.metadata.date,
    lineItems: expenseData.lineItems,
    extractedAt: yield* askDateNow(),
  });

  return expenseData;
}
```

### Batch Expense Processing

```typescript
function* processExpenseBatch(filePaths: string[]) {
  const results = [];

  for (const filePath of filePaths) {
    try {
      const expense = yield* askExtractExpense('receipts-drive', filePath);
      results.push({ filePath, success: true, expense });
    } catch (error) {
      yield* askLogCreate(LogLevelEnum.ERROR, 'Expense extraction failed', {
        filePath,
        error: error.message,
      });
      results.push({ filePath, success: false, error: error.message });
    }
  }

  return results;
}
```

## Error Handling

```typescript
function* safeExtractExpense(storageDrive: string, filePath: string) {
  const result = yield* askCatch(
    askExtractExpense(storageDrive, filePath)
  );

  if (!result.success) {
    switch (result.error.errorType) {
      case 'FileNotFound':
        yield* askLogCreate(LogLevelEnum.WARN, 'Receipt file not found', { filePath });
        return null;

      case 'UnsupportedFormat':
        yield* askThrowError('BAD_REQUEST', 'Unsupported file format for expense extraction');
        break;

      case 'RateLimited':
        // Retry after a delay
        yield* askDelay(5000);
        return yield* askExtractExpense(storageDrive, filePath);

      default:
        throw result.error;
    }
  }

  return result.result;
}
```

## Related Actions

- **File Actions** — For uploading and reading documents from storage drives
- **Key-Value Store Actions** — For persisting extracted expense data
- **Queue Actions** — For async batch extraction workflows
