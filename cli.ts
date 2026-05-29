#!/usr/bin/env node
// ─── Clarik CLI ───
// Commands:
//   npx clarik install     — install into Claude Desktop + Claude Code
//   npx clarik activate    — unlock Pro with a license key
//   npx clarik status      — show plan, tools, savings, grace period
//   npx clarik upgrade     — open clarik.dev/pro in browser
//   npx clarik uninstall   — clean removal from all configs

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main(): Promise<void> {
  switch (command) {
    case 'install':
      const { runInstall } = await import('./install.js');
      await runInstall();
      break;

    case 'activate': {
      const key = args[1];
      if (!key) {
        console.log('Usage: npx clarik activate YOUR-KEY');
        console.log('Get your key at: https://clarik.dev/pro');
        process.exit(1);
      }
      const { validateLicense } = await import('./src/license/validate.js');
      const status = await validateLicense(key);
      if (status.isValid && status.tier !== 'free') {
        console.log('');
        console.log('✅ License activated! You now have access to all 20 tools.');
        console.log(`   Tier: ${status.tier.toUpperCase()}`);
        console.log('');
      } else {
        console.log('');
        console.log('❌ Invalid license key.');
        console.log('   Get a valid key at: https://clarik.dev/pro');
        console.log('');
      }
      break;
    }

    case 'status': {
      const { getLicenseStatus } = await import('./src/license/validate.js');
      const status = await getLicenseStatus();
      console.log('');
      console.log('╔═══════════════════════════════════════╗');
      console.log('║           Clarik Status                ║');
      console.log('╚═══════════════════════════════════════╝');
      console.log('');
      console.log(`  Plan:     ${status.tier.toUpperCase()}`);
      console.log(`  Tools:    ${status.tier === 'free' ? '8 / 20' : '20 / 20'}`);
      console.log(`  Valid:    ${status.isValid ? '✅ Yes' : '❌ No'}`);
      if (status.isOffline) {
        console.log(`  Offline:  ⚠️  Grace period — ${status.graceDaysRemaining} days remaining`);
      }
      console.log('');
      console.log('  💰 Estimated monthly savings:');
      console.log('     Without Clarik: ~$78/month');
      console.log('     With Clarik:    ~$5–31/month');
      console.log('     You save:       ~$47–73/month');
      console.log('');
      if (status.tier === 'free') {
        console.log('  Unlock all 20 tools → https://clarik.dev/pro');
        console.log('');
      }
      break;
    }

    case 'upgrade': {
      const url = 'https://clarik.dev/pro';
      console.log(`Opening ${url} ...`);
      const { exec } = await import('node:child_process');
      const platform = process.platform;
      const cmd = platform === 'win32' ? `start ${url}`
        : platform === 'darwin' ? `open ${url}`
        : `xdg-open ${url}`;
      exec(cmd);
      break;
    }

    case 'uninstall': {
      const { runUninstall } = await import('./install.js');
      await runUninstall();
      break;
    }

    case 'help':
    default:
      console.log('');
      console.log('  Clarik — Clarity and memory for Claude');
      console.log('');
      console.log('  Commands:');
      console.log('    npx clarik install          Install into Claude Desktop + Claude Code');
      console.log('    npx clarik activate KEY     Unlock Pro tools with license key');
      console.log('    npx clarik status           Show plan, tools, savings, grace period');
      console.log('    npx clarik upgrade          Open clarik.dev/pro in browser');
      console.log('    npx clarik uninstall        Clean removal from all configs');
      console.log('');
      break;
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
