import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export const metadata = {
    title: "How to Create a Service Account for Google Search Console | GSC Dashboard",
    description: "Step-by-step guide to create a Google Cloud service account, enable required APIs, and grant access to Google Search Console for URL indexing.",
};

export default function HowToCreateServiceAccountPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header Section */}
                <div className="text-center mb-12">
                    <Badge variant="secondary" className="mb-4">Documentation</Badge>
                    <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
                        Google Search Console API Setup Using a Service Account
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Follow this comprehensive guide to create a service account, enable required APIs,
                        and connect your application to Google Search Console for automated URL indexing.
                    </p>
                </div>

                {/* Introduction Card */}
                <Card className="mb-8 border-l-4 border-l-primary">
                    <CardHeader>
                        <CardTitle>What You'll Learn</CardTitle>
                        <CardDescription>
                            This guide will walk you through three essential steps
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-2 list-decimal list-inside text-muted-foreground">
                            <li>Create a service account in Google Cloud Console</li>
                            <li>Enable the required APIs for Search Console</li>
                            <li>Grant the service account access to your Search Console property</li>
                        </ol>
                    </CardContent>
                </Card>

                {/* Step 1: Create Service Account */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                                1
                            </div>
                            <div>
                                <CardTitle className="text-2xl">Create a Service Account in Google Cloud</CardTitle>
                                <CardDescription>Set up your service account and download the credentials</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Step 1.1 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">1.1</span>
                                Navigate to Google Cloud Console
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Go to the{" "}
                                <a
                                    href="https://console.cloud.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-medium"
                                >
                                    Google Cloud Console
                                </a>
                                . Select an existing project or create a new one from the project dropdown menu.
                            </p>
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Screenshot of Google Cloud Console homepage</p>
                            </div>
                        </div>

                        {/* Step 1.2 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">1.2</span>
                                Access the Credentials Page
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                In the left navigation menu, go to:
                            </p>
                            <div className="bg-secondary/50 rounded-md p-4 border-l-4 border-l-primary">
                                <p className="font-mono text-sm">
                                    APIs & Services → Credentials
                                </p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Navigation path to Credentials</p>
                            </div>
                        </div>

                        {/* Step 1.3 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">1.3</span>
                                Create the Service Account
                            </h3>
                            <ol className="space-y-2 list-decimal list-inside text-muted-foreground ml-4">
                                <li>Click <strong className="text-foreground">Create Credentials</strong> → <strong className="text-foreground">Service account</strong></li>
                                <li>Enter a <strong className="text-foreground">Service account name</strong> (e.g., "GSC Indexing Bot")</li>
                                <li>Add an optional description (e.g., "Service account for Google Search Console API access")</li>
                                <li>Click <strong className="text-foreground">Create and Continue</strong></li>
                                <li>Click <strong className="text-foreground">Continue</strong> (skip role assignment for now)</li>
                                <li>Click <strong className="text-foreground">Done</strong></li>
                            </ol>
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Service account creation dialog</p>
                            </div>
                        </div>

                        {/* Step 1.4 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">1.4</span>
                                Get the Service Account Email
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                On the Credentials page, you'll see your newly created service account listed.
                                <strong className="text-foreground"> Copy the service account email</strong> — you'll need this later.
                            </p>
                            <div className="bg-secondary/50 rounded-md p-4 border border-border">
                                <p className="text-xs text-muted-foreground mb-2">Example service account email:</p>
                                <code className="text-sm font-mono text-foreground">
                                    gsc-indexing-bot@my-project-123456.iam.gserviceaccount.com
                                </code>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Service account email in credentials list</p>
                            </div>
                        </div>

                        {/* Step 1.5 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">1.5</span>
                                Create and Download the JSON Key
                            </h3>
                            <ol className="space-y-2 list-decimal list-inside text-muted-foreground ml-4">
                                <li>Click on the <strong className="text-foreground">service account email</strong> to open its details</li>
                                <li>Navigate to the <strong className="text-foreground">Keys</strong> tab</li>
                                <li>Click <strong className="text-foreground">Add Key</strong> → <strong className="text-foreground">Create new key</strong></li>
                                <li>Select <strong className="text-foreground">JSON</strong> as the key type</li>
                                <li>Click <strong className="text-foreground">Create</strong></li>
                            </ol>

                            <Alert className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
                                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                                    ⚠️ <strong>Important:</strong> The JSON file will download automatically to your computer.
                                    Store this file securely — it contains sensitive credentials that grant access to your Google Cloud resources.
                                </AlertDescription>
                            </Alert>

                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Keys tab with "Create new key" dialog</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Step 2: Enable Required APIs */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                                2
                            </div>
                            <div>
                                <CardTitle className="text-2xl">Enable Required APIs</CardTitle>
                                <CardDescription>Activate the APIs needed for URL indexing</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Step 2.1 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">2.1</span>
                                Navigate to API Library
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                In the Google Cloud Console, click the hamburger menu (☰) in the top-left corner and navigate to:
                            </p>
                            <div className="bg-secondary/50 rounded-md p-4 border-l-4 border-l-primary">
                                <p className="font-mono text-sm">
                                    APIs & Services → Library
                                </p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Navigation to API Library</p>
                            </div>
                        </div>

                        {/* Step 2.2 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">2.2</span>
                                Enable APIs for URL Indexing
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                You need to enable <strong className="text-foreground">two APIs</strong> for the service account to work with Google Search Console:
                            </p>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                                    <h4 className="font-semibold text-foreground mb-2">1. Google Search Console API</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Provides access to Search Console data and properties
                                    </p>
                                </div>
                                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                                    <h4 className="font-semibold text-foreground mb-2">2. Web Search Indexing API</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Required for publishing or removing URLs from Google's index
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                <p className="text-sm font-medium text-foreground">For each API:</p>
                                <ol className="space-y-2 list-decimal list-inside text-muted-foreground ml-4">
                                    <li>Search for the API name in the search bar</li>
                                    <li>Click on the API from the search results</li>
                                    <li>Click the <strong className="text-foreground">Enable</strong> button</li>
                                    <li>Wait for the API to be activated (usually takes a few seconds)</li>
                                </ol>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: API Library with search results</p>
                            </div>
                        </div>

                        {/* Step 2.3 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">2.3</span>
                                Verify API Enablement
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                To confirm the APIs are enabled, navigate to:
                            </p>
                            <div className="bg-secondary/50 rounded-md p-4 border-l-4 border-l-primary">
                                <p className="font-mono text-sm">
                                    APIs & Services → Enabled APIs & Services
                                </p>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">
                                You should see both APIs listed here.
                            </p>
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Enabled APIs list showing both APIs</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Step 3: Grant Access in Google Search Console */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                                3
                            </div>
                            <div>
                                <CardTitle className="text-2xl">Grant Access in Google Search Console</CardTitle>
                                <CardDescription>Add the service account as a user to your property</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Step 3.1 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">3.1</span>
                                Open Google Search Console
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Navigate to{" "}
                                <a
                                    href="https://search.google.com/search-console"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-medium"
                                >
                                    Google Search Console
                                </a>
                                {" "}and select the website property you want to connect to your application.
                            </p>
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Google Search Console property selector</p>
                            </div>
                        </div>

                        {/* Step 3.2 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">3.2</span>
                                Access Users and Permissions
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                In the left sidebar, click on <strong className="text-foreground">Settings</strong>, then select{" "}
                                <strong className="text-foreground">Users and permissions</strong>.
                            </p>
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Settings menu with Users and permissions highlighted</p>
                            </div>
                        </div>

                        {/* Step 3.3 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">3.3</span>
                                Add the Service Account
                            </h3>
                            <ol className="space-y-2 list-decimal list-inside text-muted-foreground ml-4">
                                <li>Click the <strong className="text-foreground">+ Add user</strong> button</li>
                                <li>In the email field, <strong className="text-foreground">paste the service account email</strong> you copied earlier</li>
                                <li>Choose a permission level (see options below)</li>
                                <li>Click <strong className="text-foreground">Add</strong></li>
                            </ol>

                            <div className="mt-4 space-y-3">
                                <p className="text-sm font-medium text-foreground">Permission Level Options:</p>
                                <div className="space-y-2">
                                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 border border-green-200 dark:border-green-900">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-green-900 dark:text-green-100">Full</h4>
                                            <Badge variant="default" className="bg-green-600">Recommended</Badge>
                                        </div>
                                        <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                                            Grants all permissions including URL inspection and indexing
                                        </p>
                                    </div>
                                    <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                                        <h4 className="font-semibold text-foreground">Restricted</h4>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Limited access; may not work for all indexing operations
                                        </p>
                                    </div>
                                    <div className="bg-secondary/50 rounded-lg p-3 border border-border">
                                        <h4 className="font-semibold text-foreground">Owner</h4>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Complete control over the property (optional, use with caution)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <p className="text-sm text-muted-foreground italic">📸 Image placeholder: Add user dialog with service account email</p>
                            </div>
                        </div>

                        {/* Step 3.4 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">3.4</span>
                                Verify Access
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                The service account should now appear in your users list with the assigned permission level.
                                Your service account can now access Search Console data for this property.
                            </p>
                            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                                <AlertDescription className="text-green-800 dark:text-green-200">
                                    ✅ <strong>Success!</strong> Your service account is now set up and has access to your Google Search Console property.
                                    You can use the JSON key file to authenticate API requests.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </CardContent>
                </Card>

                {/* Next Steps Card */}
                <Card className="mb-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-xl">🎉 Next Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-muted-foreground leading-relaxed">
                            Now that your service account is configured, you can:
                        </p>
                        <ul className="space-y-2 list-disc list-inside text-muted-foreground ml-4">
                            <li>Upload the JSON key file to your application's credential management system</li>
                            <li>Test the connection to verify the service account has the correct permissions</li>
                            <li>Start submitting URLs for indexing through the Google Search Console API</li>
                            <li>Monitor your indexing requests and track submission history</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Additional Resources */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">📚 Additional Resources</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-muted-foreground">
                            For more information, check out these official Google documentation pages:
                        </p>
                        <ul className="space-y-2">
                            <li>
                                <a
                                    href="https://developers.google.com/search/apis/indexing-api/v3/quickstart"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    Google Indexing API Quickstart →
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://support.google.com/webmasters/answer/9012289"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    Google Search Console API Documentation →
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://cloud.google.com/iam/docs/service-accounts"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                    Understanding Service Accounts →
                                </a>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        Need help? If you have questions or run into issues, please contact your administrator.
                    </p>
                </div>
            </div>
        </div>
    );
}
