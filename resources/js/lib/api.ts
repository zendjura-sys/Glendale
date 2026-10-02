export function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly errors: Record<string, string[]> = {},
    ) {
        super(message);
    }
}

/**
 * JSON-запит до бекенду з CSRF-токеном Laravel (для лайків, коментарів, пошуку).
 */
export async function api<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    body?: Record<string, unknown> | FormData,
): Promise<T> {
    const isForm = body instanceof FormData;
    const init: RequestInit = {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(isForm ? {} : { 'Content-Type': 'application/json' }),
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken(),
        },
    };

    if (method !== 'GET' && body !== undefined) {
        init.body = isForm ? body : JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        throw new ApiError(
            payload.message ?? 'Щось пішло не так. Спробуйте ще раз.',
            response.status,
            payload.errors ?? {},
        );
    }

    return response.status === 204 ? (undefined as T) : response.json();
}
