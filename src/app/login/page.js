import LoginForm from '@/components/ui/login-form';
import { getSettings } from '@/lib/settings';

export default async function LoginPage() {
    const settings = await getSettings();

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 overflow-y-auto py-12 px-4 whitespace-normal">
            <div className="relative mx-auto flex w-full max-w-md flex-col space-y-2.5 min-h-[480px]">
                <LoginForm logoUrl={settings?.logoUrl} />
            </div>
        </main>
    );
}
