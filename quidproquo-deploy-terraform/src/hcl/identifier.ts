const HCL_IDENT = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Returns true if `value` may be emitted unquoted as an HCL identifier.
 *
 * The HCL grammar permits hyphens inside identifiers used as object keys
 * (`{ my-key = 1 }` parses) but block-type and label names are accepted by
 * Terraform in the same shape, so we use the same predicate everywhere.
 */
export const isValidHclIdentifier = (value: string): boolean => HCL_IDENT.test(value);
