import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PartyPopper, Lightbulb, AlertTriangle } from "lucide-react";

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
                            <div className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-white" style={{ backgroundColor: '#e62f30' }}>
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
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                Go to the{" "}
                                <a
                                    href="https://console.cloud.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline font-medium"
                                >
                                    Google Cloud Console
                                </a>
                                . If you don't have an existing project, you'll need to create a new one.
                            </p>

                            <p className="text-muted-foreground leading-relaxed mb-2">
                                The homepage will look like this:
                            </p>
                            <div className="mt-2 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/google-cloud-console-homepage.png"
                                    alt="Google Cloud Console homepage showing project selection"
                                    className="w-full h-auto"
                                />
                            </div>

                            <p className="text-muted-foreground leading-relaxed mt-4 mb-2">
                                Click on the project dropdown at the top, then click <strong className="text-foreground">NEW PROJECT</strong>:
                            </p>
                            {/* New Project Creation Screenshot */}
                            <div className="mt-2 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/new-project-create.png"
                                    alt="Creating a new project in Google Cloud Console"
                                    className="w-full h-auto"
                                />
                            </div>

                            <p className="text-muted-foreground leading-relaxed mt-4 mb-2">
                                Enter a <strong className="text-foreground">Project name</strong> (e.g., "GSC Analytics") and click <strong className="text-foreground">CREATE</strong>:
                            </p>
                            {/* Project Name Assignment Screenshot */}
                            <div className="mt-2 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/assign-new-project-name.png"
                                    alt="Assigning a name to the new Google Cloud project"
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        {/* Step 1.2 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">1.2</span>
                                Access the Credentials Page
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
                                In the left hamburger menu, go to:
                            </p>
                            <div className="bg-secondary/50 rounded-md p-4 border-l-4 border-l-primary">
                                <p className="font-mono text-sm">
                                    APIs & Services → Credentials
                                </p>
                            </div>
                            <div className="mt-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/api-credentials-hamburger.png"
                                    alt="Navigation to APIs & Services Credentials from hamburger menu"
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        {/* Step 1.3 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">1.3</span>
                                Create the Service Account
                            </h3>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                Click <strong className="text-foreground">Create Credentials</strong> → <strong className="text-foreground">Service account</strong>
                            </p>

                            {/* Service Account Selection Screenshot */}
                            <div className="mt-2 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/select-service-account-option.png"
                                    alt="Selecting Service Account from Create Credentials dropdown"
                                    className="w-full h-auto"
                                />
                            </div>

                            <p className="text-muted-foreground leading-relaxed mt-4 mb-3">
                                Fill in the service account details:
                            </p>
                            <ol className="space-y-2 list-decimal list-inside text-muted-foreground ml-4">
                                <li>Enter a <strong className="text-foreground">Service account name</strong> (e.g., "GSC Service Account")</li>
                                <li>Add an optional description (e.g., "Service account for Google Search Console API access")</li>
                                <li>Click <strong className="text-foreground">Create and Continue</strong></li>
                                <li>Click <strong className="text-foreground">Continue</strong> (skip role assignment for now)</li>
                                <li>Click <strong className="text-foreground">Done</strong></li>
                            </ol>

                            {/* Service Account Creation Screenshot */}
                            <div className="mt-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/service-account-creation.png"
                                    alt="Service account creation form with name and description fields"
                                    className="w-full h-auto"
                                />
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
                                    gsc-service-account@gsc-analytics-486907.iam.gserviceaccount.com
                                </code>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">Click the service account email shown in the screenshot below.</p>
                            <div className="mt-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/click-service-email.png"
                                    alt="Service account email displayed in credentials list"
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        {/* Step 1.5 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <span className="text-primary">1.5</span>
                                Create and Download the JSON Key
                            </h3>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                Click on the <strong className="text-foreground">service account email</strong> to open its details, then navigate to the <strong className="text-foreground">Keys</strong> tab.
                            </p>

                            {/* Keys Tab Navigation Screenshot */}
                            <div className="mt-2 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/keys-tab-navigate.png"
                                    alt="Navigating to the Keys tab in service account details"
                                    className="w-full h-auto"
                                />
                            </div>

                            <p className="text-muted-foreground leading-relaxed mt-4 mb-3">
                                Create a new JSON key:
                            </p>
                            <ol className="space-y-2 list-decimal list-inside text-muted-foreground ml-4">
                                <li>Click <strong className="text-foreground">Add Key</strong> → <strong className="text-foreground">Create new key</strong></li>
                                <li>Select <strong className="text-foreground">JSON</strong> as the key type</li>
                                <li>Click <strong className="text-foreground">Create</strong></li>
                            </ol>

                            {/* Create New Key Screenshot */}
                            <div className="mt-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/create-new-key.png"
                                    alt="Creating a new JSON key for the service account"
                                    className="w-full h-auto"
                                />
                            </div>

                            <Alert className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900 mt-4">
                                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                                    <strong>Important:</strong> The JSON file will download automatically to your computer.
                                    Store this file securely — it contains sensitive credentials that grant access to your Google Cloud resources.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </CardContent>
                </Card>

                {/* Step 2: Enable Required APIs */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-white" style={{ backgroundColor: '#e62f30' }}>
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

                            {/* Google Search Console API Screenshot */}
                            <div className="mt-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/api-google-search-console.png"
                                    alt="Google Search Console API in the API Library"
                                    className="w-full h-auto"
                                />
                            </div>

                            {/* Web Search Indexing API Screenshot */}
                            <div className="mt-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/api-web-search-indexing.png"
                                    alt="Web Search Indexing API in the API Library"
                                    className="w-full h-auto"
                                />
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
                        </div>
                    </CardContent>
                </Card>

                {/* Step 3: Grant Access in Google Search Console */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-white" style={{ backgroundColor: '#e62f30' }}>
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
                            <div className="mt-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/gsc-select-property.png"
                                    alt="Google Search Console property selector showing available properties"
                                    className="w-full h-auto"
                                />
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
                            <div className="mt-4 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/users-permission-gsc.png"
                                    alt="Settings menu showing Users and permissions option in Google Search Console"
                                    className="w-full h-auto"
                                />
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
                                    <strong>Success!</strong> Your service account is now set up and has access to your Google Search Console property.
                                    You can use the JSON key file to authenticate API requests.
                                </AlertDescription>
                            </Alert>
                        </div>
                    </CardContent>
                </Card>

                {/* Next Steps Card */}
                <Card className="mb-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <PartyPopper className="w-5 h-5" />
                            Next Steps: Upload the Service Account JSON Key
                        </CardTitle>
                        <CardDescription>Connect your service account to the GSC Analytics tool</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground leading-relaxed">
                            After downloading the JSON key, follow these steps to connect it to the GSC Analytics tool.
                        </p>

                        {/* Step 1 */}
                        <div className="space-y-2">
                            <p className="font-semibold text-foreground">1. Go to GSC Analytics</p>
                            <a
                                href="https://gscanalytics.eduwhistle.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-medium w-fit cursor-pointer"
                            >
                                https://gscanalytics.eduwhistle.com/
                            </a>
                        </div>

                        {/* Step 2 */}
                        <div className="space-y-2">
                            <p className="font-semibold text-foreground">2. Log in to your account</p>
                        </div>

                        {/* Step 3 */}
                        <div className="space-y-2">
                            <p className="font-semibold text-foreground">3. Open the Credentials page</p>
                            <a
                                href="https://gscanalytics.eduwhistle.com/dashboard/credentials"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-medium w-fit cursor-pointer"
                            >
                                https://gscanalytics.eduwhistle.com/dashboard/credentials
                            </a>
                        </div>

                        {/* Step 4 */}
                        <div className="space-y-2">
                            <p className="font-semibold text-foreground">4. Click the "Add Service Account Credentials" button</p>
                        </div>

                        {/* Step 5 */}
                        <div className="space-y-2">
                            <p className="font-semibold text-foreground">5. In the form:</p>
                            <ul className="space-y-1 list-disc list-inside text-muted-foreground ml-4">
                                <li>Enter your <strong className="text-foreground">Website URL</strong></li>
                                <li>Upload the downloaded <strong className="text-foreground">JSON key file</strong></li>
                                <li>Click <strong className="text-foreground">"Save & Connect"</strong></li>
                            </ul>
                            <div className="mt-3 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/service-account-credentials-form.png"
                                    alt="Service Account Credentials upload form in GSC Analytics"
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        {/* Step 6 */}
                        <div className="space-y-2">
                            <p className="font-semibold text-foreground">6. Verify connection success</p>
                            <p className="text-muted-foreground">
                                Once the connection is successful, the interface will display a confirmation screen like the one shown below.
                            </p>
                            <div className="mt-3 rounded-lg border border-border overflow-hidden bg-muted/30">
                                <img
                                    src="/images/documentation/gsc-connection.png"
                                    alt="GSC Analytics connection success confirmation screen"
                                    className="w-full h-auto"
                                />
                            </div>
                        </div>

                        <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 mt-4">
                            <AlertDescription className="text-blue-800 dark:text-blue-200">
                                <Lightbulb className="w-4 h-4 inline mr-1" />
                                <strong>Tip:</strong> Keep your JSON key file secure and never share it publicly. If compromised, you can delete and create a new key from the Google Cloud Console.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
