import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantInfo } from './types.js';

/**
 * TenantContext provides thread-safe (async-safe) access to the current tenant context.
 *
 * Uses Node.js AsyncLocalStorage to maintain TenantInfo throughout the
 * execution of a request without needing to pass it as a parameter.
 *
 * Initialization:
 *   - In HTTP requests: the `initTenantContext` middleware extracts the tenant
 *     from JWT claims or headers and calls `TenantContext.set()`.
 *   - In EventBridge/SQS: the handler extracts tenantId from event.detail and calls `TenantContext.run()`.
 *
 * Consumption:
 *   - TenantAwareDynamoRepository: `TenantContext.current().tenantId`
 *   - ApiInvoker: `TenantContext.currentOptional()` to propagate headers
 *   - Use cases: `TenantContext.current()` when they need the tenant explicitly
 *
 * IMPORTANT:
 *   - `current()` is FAIL-CLOSED: throws error if no context (prevents data leaks).
 *   - `currentOptional()` returns undefined without error (for code that works with/without tenant).
 *   - `run()` is for scenarios where an explicit scope is needed (EventBridge handlers).
 *   - `set()` is for the orchestrator middleware that operates in the same async scope.
 */
export class TenantContext {
  private static storage = new AsyncLocalStorage<TenantInfo>();

  /**
   * Executes a callback within a tenant context.
   * Useful for EventBridge/SQS handlers where there's no orchestrator middleware.
   *
   * @example
   * ```typescript
   * await TenantContext.run(tenantInfo, async () => {
   *   const props = await propertiesRepo.findByStatus('PUBLISHED');
   *   // propertiesRepo automatically filters by tenantInfo.tenantId
   * });
   * ```
   */
  static run<T>(tenant: TenantInfo, callback: () => T): T {
    return this.storage.run(tenant, callback);
  }

  /**
   * Sets the tenant context in the current AsyncLocalStorage store.
   * ONLY should be called by the initTenantContext middleware.
   *
   * NOTE: Requires an active store (created by AsyncLocalStorage.run()
   * or by the Lambda runtime). If called outside an async context,
   * the value is lost. For those cases, use `run()`.
   *
   * Internally uses enterWith() which replaces the current store.
   */
  static set(tenant: TenantInfo): void {
    this.storage.enterWith(tenant);
  }

  /**
   * Gets the current TenantInfo. FAIL-CLOSED: throws error if not initialized.
   * Use in code that REQUIRES a tenant (repositories, guards).
   *
   * @throws Error if TenantContext is not initialized
   *
   * @example
   * ```typescript
   * const { tenantId } = TenantContext.current();
   * // Safe: if we get here, tenantId exists
   * ```
   */
  static current(): TenantInfo {
    const tenant = this.storage.getStore();
    if (!tenant) {
      throw new Error(
        'TenantContext not initialized. Ensure initTenantContext middleware is configured ' +
        'in globalMiddleware, or use TenantContext.run() for non-HTTP triggers.'
      );
    }
    return tenant;
  }

  /**
   * Gets the current TenantInfo or undefined if not initialized.
   * Use in code that works with or without tenant (ApiInvoker, loggers, public routes).
   *
   * @example
   * ```typescript
   * const tenant = TenantContext.currentOptional();
   * if (tenant) {
   *   headers['x-tenant-id'] = tenant.tenantId;
   * }
   * ```
   */
  static currentOptional(): TenantInfo | undefined {
    return this.storage.getStore();
  }

  /**
   * Checks if there's an active tenant context.
   * Useful for conditionals without getting the full object.
   */
  static isActive(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /**
   * Clears the current context. Only for testing.
   * DO NOT use in production — the context is automatically cleaned when exiting the scope.
   * @internal
   */
  static _reset(): void {
    this.storage.disable();
    (this as any).storage = new AsyncLocalStorage<TenantInfo>();
  }
}
