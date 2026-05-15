---
name: verbose-multi-section
description: Verbose release procedure for deploying to production. Demonstrates multi-section instruction format suitable for aggressive distillation. Good fixture for zero-shot skill testing.
model: sonnet
---

# Production Release Procedure

## Pre-Release Planning

Before you begin the release process, it is essential that you take the time to plan what you are releasing and ensure that all stakeholders have been notified of the upcoming deployment. This means coordinating with your product team, devops engineers, and support staff to establish a release window that minimizes disruption to users and gives everyone adequate time to prepare for any potential issues. You should verify that there is sufficient capacity in your incident response team to handle any problems that arise immediately after the deployment, and you should confirm that all necessary monitoring and alerting has been configured in advance.

## Preparation and Testing

The most critical step before deploying anything to production is to ensure that the code has been thoroughly tested in a staging environment that mirrors production as closely as possible. You should run the complete test suite multiple times to verify that all functionality works as expected, and you should pay special attention to any code paths that have been significantly modified or newly introduced. Additionally, you should verify that all database migrations have been tested on a copy of the production database, and that you have a clear rollback strategy in case something goes wrong during the deployment itself.

## Documentation and Communication

It is vital that you update all relevant documentation before the release, including changelog entries, API documentation if any endpoints have changed, and internal runbooks that describe how to operate or troubleshoot the new functionality. You should also prepare clear, concise communication for your users explaining what has changed, how it affects them, and where they can get support if they encounter problems. This communication should be written in plain language that non-technical users can understand, and should highlight any breaking changes or required actions on the user's part.

## Deployment Execution

When you are ready to deploy, you should follow these substeps in the order listed to ensure the deployment proceeds safely and smoothly.

### Step 1: Final Verification

Before you start the actual deployment, perform a final verification that all tests pass in the staging environment, that the deployment package has been built correctly, and that all necessary permissions and credentials are in place for the deployment tooling to access the required infrastructure resources.

### Step 2: Execute the Deployment

Run the deployment script or follow the manual deployment procedure depending on whether your infrastructure uses automation. Monitor the deployment logs carefully as the deployment proceeds to ensure that each step completes successfully. If you notice any errors, stop the deployment immediately and begin the rollback procedure rather than attempting to continue forward.

### Step 3: Post-Deployment Verification

After the deployment completes, immediately verify that the service is healthy by checking application logs, running smoke tests against the production environment, and reviewing monitoring dashboards to confirm that key metrics remain within expected ranges. Only after you have confirmed that everything is functioning normally should you notify stakeholders that the release is complete.

## Monitoring and Rollback

After your deployment is complete, you should maintain heightened attention to system monitoring for at least several hours or until you are confident that the deployment has stabilized. Keep your incident response team on standby during this period so that if any unexpected problems emerge, you can respond quickly. You should have a tested rollback procedure documented and ready to execute at any time during the post-deployment period, and you should not hesitate to execute it if you detect any critical issues that cannot be resolved quickly through configuration changes.
