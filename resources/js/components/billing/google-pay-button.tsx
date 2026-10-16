import { useEffect, useRef, useState } from 'react';
import type { GooglePayConfig } from '@/types/billing';

/**
 * Нативна кнопка Google Pay (https://developers.google.com/pay/api/web). Токен оплати шлюзу monobank
 * передається на сервер, той — у monobank (wallet/payment, aToken). Кнопка з’являється, лише якщо
 * Google Pay доступний у браузері людини.
 */

type PaymentsClient = {
    isReadyToPay: (request: unknown) => Promise<{ result: boolean }>;
    createButton: (options: Record<string, unknown>) => HTMLElement;
    loadPaymentData: (request: unknown) => Promise<{
        paymentMethodData: { tokenizationData: { token: string } };
    }>;
};

type GoogleNamespace = {
    payments: {
        api: {
            PaymentsClient: new (options: {
                environment: string;
            }) => PaymentsClient;
        };
    };
};

const SCRIPT = 'https://pay.google.com/gp/p/js/pay.js';
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
    if ((window as unknown as { google?: GoogleNamespace }).google?.payments) {
        return Promise.resolve();
    }
    loading ??= new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            loading = null;
            reject(new Error('Google Pay недоступний'));
        };
        document.head.appendChild(script);
    });

    return loading;
}

function baseMethod(config: GooglePayConfig) {
    return {
        type: 'CARD',
        parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: config.networks,
        },
        tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: {
                gateway: config.gateway,
                gatewayMerchantId: config.gateway_merchant_id ?? '',
            },
        },
    };
}

export function GooglePayButton({
    config,
    amount,
    onToken,
    disabled,
}: {
    config: GooglePayConfig;
    /** Сума до сплати, копійки. */
    amount: number;
    /** Токен оплати (paymentMethodData.tokenizationData.token) — віддати серверу. */
    onToken: (token: string) => Promise<void>;
    disabled?: boolean;
}) {
    const holder = useRef<HTMLDivElement>(null);
    const [client, setClient] = useState<PaymentsClient | null>(null);

    useEffect(() => {
        let alive = true;
        loadScript()
            .then(async () => {
                const google = (
                    window as unknown as { google: GoogleNamespace }
                ).google;
                const payments = new google.payments.api.PaymentsClient({
                    environment: config.environment,
                });
                const ready = await payments.isReadyToPay({
                    apiVersion: 2,
                    apiVersionMinor: 0,
                    allowedPaymentMethods: [baseMethod(config)],
                });
                if (alive && ready.result) {
                    setClient(payments);
                }
            })
            .catch(() => undefined);

        return () => {
            alive = false;
        };
    }, [config]);

    useEffect(() => {
        if (!client || !holder.current) return;
        const pay = async () => {
            if (disabled) return;
            try {
                const data = await client.loadPaymentData({
                    apiVersion: 2,
                    apiVersionMinor: 0,
                    allowedPaymentMethods: [baseMethod(config)],
                    merchantInfo: {
                        merchantName: config.merchant_name,
                        ...(config.merchant_id
                            ? { merchantId: config.merchant_id }
                            : {}),
                    },
                    transactionInfo: {
                        totalPriceStatus: 'FINAL',
                        totalPrice: (amount / 100).toFixed(2),
                        currencyCode: 'UAH',
                        countryCode: 'UA',
                    },
                });
                await onToken(data.paymentMethodData.tokenizationData.token);
            } catch {
                // Людина закрила вікно Google Pay — нічого не робимо.
            }
        };
        const button = client.createButton({
            onClick: pay,
            buttonColor: 'black',
            buttonType: 'pay',
            buttonSizeMode: 'fill',
            buttonLocale: 'uk',
        });
        holder.current.replaceChildren(button);
    }, [client, config, amount, onToken, disabled]);

    if (!client) return null;

    return (
        <div ref={holder} className="h-11 w-full overflow-hidden rounded-xl" />
    );
}
