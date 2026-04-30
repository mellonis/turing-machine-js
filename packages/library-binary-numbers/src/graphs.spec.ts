import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {State, toMermaid} from '@turing-machine-js/machine';
import binaryNumbers from './index';

describe('library-binary-numbers state graphs', () => {
  test('renders Mermaid for every exported state', () => {
    const sections: string[] = ['# library-binary-numbers — state graphs', ''];
    const stateNames = Object.keys(binaryNumbers.states) as Array<keyof typeof binaryNumbers.states>;

    for (const name of stateNames) {
      const tapeBlock = binaryNumbers.getTapeBlock();
      const graph = State.toGraph(binaryNumbers.states[name], tapeBlock);
      const mermaid = toMermaid(graph);
      const nodeCount = Object.keys(graph.nodes).length;

      sections.push(`## ${name}`);
      sections.push('');
      sections.push(`*${nodeCount} state${nodeCount === 1 ? '' : 's'} (including \`haltState\`)*`);
      sections.push('');
      sections.push('```mermaid');
      sections.push(mermaid);
      sections.push('```');
      sections.push('');
    }

    const output = sections.join('\n');
    const outputPath = resolve(__dirname, '..', 'states.md');

    writeFileSync(outputPath, output);

    expect(output.length).toBeGreaterThan(0);
    expect(stateNames.length).toBeGreaterThan(0);
  });
});
