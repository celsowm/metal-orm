import { describe, it, expect } from 'vitest';

const {
  pluralizeWordPtBr,
  singularizeWordPtBr,
  pluralizeRelationPropertyPtBr,
  singularizeRelationPropertyPtBr,
  PT_BR_DEFAULT_IRREGULARS,
  createPtBrInflector
} = await import('../../scripts/inflection/pt-br.mjs');

describe('pt-br inflection', () => {
  describe('pluralizeWordPtBr', () => {
    describe('-ão endings', () => {
      it('default: -ão → -ões', () => {
        expect(pluralizeWordPtBr('aviao')).toBe('avioes');
        expect(pluralizeWordPtBr('caminhao')).toBe('caminhoes');
        expect(pluralizeWordPtBr('coração')).toBe('coracoes');
        expect(pluralizeWordPtBr('limao')).toBe('limoes');
        expect(pluralizeWordPtBr('botao')).toBe('botoes');
        expect(pluralizeWordPtBr('questao')).toBe('questoes');
        expect(pluralizeWordPtBr('sessao')).toBe('sessoes');
      });

      it('irregular: -ão → -ães', () => {
        expect(pluralizeWordPtBr('pao')).toBe('paes');
        expect(pluralizeWordPtBr('cao')).toBe('caes');
        expect(pluralizeWordPtBr('alemao')).toBe('alemaes');
        expect(pluralizeWordPtBr('capitao')).toBe('capitaes');
        expect(pluralizeWordPtBr('charlatao')).toBe('charlataes');
        expect(pluralizeWordPtBr('escrivao')).toBe('escrivaes');
        expect(pluralizeWordPtBr('tabeliao')).toBe('tabeliaes');
      });

      it('irregular: -ão → -ãos', () => {
        expect(pluralizeWordPtBr('mao')).toBe('maos');
        expect(pluralizeWordPtBr('cidadao')).toBe('cidadaos');
        expect(pluralizeWordPtBr('cristao')).toBe('cristaos');
        expect(pluralizeWordPtBr('irmao')).toBe('irmaos');
        expect(pluralizeWordPtBr('orgao')).toBe('orgaos');
        expect(pluralizeWordPtBr('bencao')).toBe('bencaos');
        expect(pluralizeWordPtBr('grao')).toBe('graos');
        expect(pluralizeWordPtBr('orfao')).toBe('orfaos');
        expect(pluralizeWordPtBr('chao')).toBe('chaos');
      });
    });

    describe('-ção endings (critical for DB tables)', () => {
      it('pluralizes -ção → -ções correctly', () => {
        expect(pluralizeWordPtBr('classificacao')).toBe('classificacoes');
        expect(pluralizeWordPtBr('classificação')).toBe('classificacoes');
        expect(pluralizeWordPtBr('solicitacao')).toBe('solicitacoes');
        expect(pluralizeWordPtBr('informacao')).toBe('informacoes');
        expect(pluralizeWordPtBr('organizacao')).toBe('organizacoes');
        expect(pluralizeWordPtBr('situacao')).toBe('situacoes');
        expect(pluralizeWordPtBr('decisao')).toBe('decisoes');
        expect(pluralizeWordPtBr('correcao')).toBe('correcoes');
        expect(pluralizeWordPtBr('migracao')).toBe('migracoes');
        expect(pluralizeWordPtBr('distribuicao')).toBe('distribuicoes');
      });
    });

    describe('-m endings', () => {
      it('pluralizes -m → -ns', () => {
        expect(pluralizeWordPtBr('homem')).toBe('homens');
        expect(pluralizeWordPtBr('viagem')).toBe('viagens');
        expect(pluralizeWordPtBr('item')).toBe('itens');
        expect(pluralizeWordPtBr('album')).toBe('albuns');
        expect(pluralizeWordPtBr('jardim')).toBe('jardins');
        expect(pluralizeWordPtBr('armazem')).toBe('armazens');
      });
    });

    describe('-l endings', () => {
      it('pluralizes -al → -ais', () => {
        expect(pluralizeWordPtBr('animal')).toBe('animais');
        expect(pluralizeWordPtBr('canal')).toBe('canais');
        expect(pluralizeWordPtBr('hospital')).toBe('hospitais');
        expect(pluralizeWordPtBr('local')).toBe('locais');
        expect(pluralizeWordPtBr('material')).toBe('materiais');
      });

      it('pluralizes -el → -eis', () => {
        expect(pluralizeWordPtBr('papel')).toBe('papeis');
        expect(pluralizeWordPtBr('nivel')).toBe('niveis');
        expect(pluralizeWordPtBr('anel')).toBe('aneis');
        expect(pluralizeWordPtBr('avel')).toBe('aveis');
      });

      it('pluralizes -ol → -ois', () => {
        expect(pluralizeWordPtBr('anzol')).toBe('anzois');
        expect(pluralizeWordPtBr('farol')).toBe('farois');
        expect(pluralizeWordPtBr('lencol')).toBe('lencois');
      });

      it('pluralizes -ul → -uis', () => {
        expect(pluralizeWordPtBr('azul')).toBe('azuis');
        expect(pluralizeWordPtBr('paul')).toBe('pauis');
      });

      it('pluralizes stressed -il → -is', () => {
        expect(pluralizeWordPtBr('barril')).toBe('barris');
        expect(pluralizeWordPtBr('funil')).toBe('funis');
        expect(pluralizeWordPtBr('fuzil')).toBe('fuzis');
      });

      it('irregular: unstressed -il → -eis', () => {
        expect(pluralizeWordPtBr('fossil')).toBe('fosseis');
        expect(pluralizeWordPtBr('reptil')).toBe('repteis');
        expect(pluralizeWordPtBr('facil')).toBe('faceis');
        expect(pluralizeWordPtBr('dificil')).toBe('dificeis');
        expect(pluralizeWordPtBr('util')).toBe('uteis');
        expect(pluralizeWordPtBr('portatil')).toBe('portateis');
      });

      it('irregular: mal → males, consul → consules', () => {
        expect(pluralizeWordPtBr('mal')).toBe('males');
        expect(pluralizeWordPtBr('consul')).toBe('consules');
      });
    });

    describe('consonant endings (r, z, n)', () => {
      it('adds -es to words ending in r', () => {
        expect(pluralizeWordPtBr('amor')).toBe('amores');
        expect(pluralizeWordPtBr('flor')).toBe('flores');
        expect(pluralizeWordPtBr('professor')).toBe('professores');
        expect(pluralizeWordPtBr('servidor')).toBe('servidores');
        expect(pluralizeWordPtBr('fator')).toBe('fatores');
        expect(pluralizeWordPtBr('usuario')).toBe('usuarios'); // not ending in r
      });

      it('adds -es to words ending in z', () => {
        expect(pluralizeWordPtBr('luz')).toBe('luzes');
        expect(pluralizeWordPtBr('paz')).toBe('pazes');
        expect(pluralizeWordPtBr('voz')).toBe('vozes');
        expect(pluralizeWordPtBr('raiz')).toBe('raizes');
        expect(pluralizeWordPtBr('juiz')).toBe('juizes');
      });

      it('adds -es to words ending in n', () => {
        expect(pluralizeWordPtBr('abdomen')).toBe('abdomenes');
        expect(pluralizeWordPtBr('hifen')).toBe('hifenes');
      });
    });

    describe('oxytone words ending in -s (gás, país, etc.)', () => {
      it('pluralizes -ás → -ases', () => {
        expect(pluralizeWordPtBr('gas')).toBe('gases');
        expect(pluralizeWordPtBr('gás')).toBe('gases');
        expect(pluralizeWordPtBr('as')).toBe('ases');
      });

      it('pluralizes -ês → -eses', () => {
        expect(pluralizeWordPtBr('mes')).toBe('meses');
        expect(pluralizeWordPtBr('mês')).toBe('meses');
        expect(pluralizeWordPtBr('portugues')).toBe('portugueses');
        expect(pluralizeWordPtBr('ingles')).toBe('ingleses');
        expect(pluralizeWordPtBr('frances')).toBe('franceses');
        expect(pluralizeWordPtBr('japones')).toBe('japoneses');
      });

      it('pluralizes -ís → -ises', () => {
        expect(pluralizeWordPtBr('pais')).toBe('paises');
        expect(pluralizeWordPtBr('país')).toBe('paises');
      });

      it('pluralizes -ós → -oses', () => {
        expect(pluralizeWordPtBr('pos')).toBe('poses');
      });

      it('pluralizes -ús → -uses', () => {
        expect(pluralizeWordPtBr('bus')).toBe('buses');
      });
    });

    describe('invariable words (paroxytones/proparoxytones ending in -s/-x)', () => {
      it('keeps paroxytones ending in -s unchanged', () => {
        expect(pluralizeWordPtBr('onibus')).toBe('onibus');
        expect(pluralizeWordPtBr('lapis')).toBe('lapis');
        expect(pluralizeWordPtBr('virus')).toBe('virus');
        expect(pluralizeWordPtBr('atlas')).toBe('atlas');
        expect(pluralizeWordPtBr('pires')).toBe('pires');
        expect(pluralizeWordPtBr('cais')).toBe('cais');
        expect(pluralizeWordPtBr('simples')).toBe('simples');
        expect(pluralizeWordPtBr('oasis')).toBe('oasis');
        expect(pluralizeWordPtBr('tenis')).toBe('tenis');
      });

      it('keeps words ending in -x unchanged', () => {
        expect(pluralizeWordPtBr('torax')).toBe('torax');
        expect(pluralizeWordPtBr('fenix')).toBe('fenix');
        expect(pluralizeWordPtBr('xerox')).toBe('xerox');
        expect(pluralizeWordPtBr('latex')).toBe('latex');
        expect(pluralizeWordPtBr('index')).toBe('index');
        expect(pluralizeWordPtBr('duplex')).toBe('duplex');
        expect(pluralizeWordPtBr('climax')).toBe('climax');
      });
    });

    describe('default: add -s', () => {
      it('adds -s to regular words ending in vowels', () => {
        expect(pluralizeWordPtBr('casa')).toBe('casas');
        expect(pluralizeWordPtBr('livro')).toBe('livros');
        expect(pluralizeWordPtBr('carro')).toBe('carros');
        expect(pluralizeWordPtBr('mesa')).toBe('mesas');
        expect(pluralizeWordPtBr('cadeira')).toBe('cadeiras');
        expect(pluralizeWordPtBr('usuario')).toBe('usuarios');
        expect(pluralizeWordPtBr('acervo')).toBe('acervos');
        expect(pluralizeWordPtBr('equipe')).toBe('equipes');
        expect(pluralizeWordPtBr('tema')).toBe('temas');
        expect(pluralizeWordPtBr('materia')).toBe('materias');
      });
    });

    describe('other irregulars', () => {
      it('handles qualquer → quaisquer', () => {
        expect(pluralizeWordPtBr('qualquer')).toBe('quaisquer');
      });

      it('handles carater → caracteres', () => {
        expect(pluralizeWordPtBr('carater')).toBe('caracteres');
      });

      it('handles junior/senior → juniores/seniores', () => {
        expect(pluralizeWordPtBr('junior')).toBe('juniores');
        expect(pluralizeWordPtBr('senior')).toBe('seniores');
      });
    });

    describe('edge cases', () => {
      it('handles empty/null input', () => {
        expect(pluralizeWordPtBr('')).toBe('');
        expect(pluralizeWordPtBr(null as any)).toBe('');
        expect(pluralizeWordPtBr(undefined as any)).toBe('');
      });

      it('handles mixed case input', () => {
        expect(pluralizeWordPtBr('CASA')).toBe('casas');
        expect(pluralizeWordPtBr('Casa')).toBe('casas');
        expect(pluralizeWordPtBr('cAsA')).toBe('casas');
      });

      it('handles input with diacritics', () => {
        expect(pluralizeWordPtBr('coração')).toBe('coracoes');
        expect(pluralizeWordPtBr('informação')).toBe('informacoes');
        expect(pluralizeWordPtBr('país')).toBe('paises');
      });
    });
  });

  describe('singularizeWordPtBr', () => {
    describe('-ões/-ães/-ãos → -ão', () => {
      it('singularizes -ões → -ão', () => {
        expect(singularizeWordPtBr('avioes')).toBe('aviao');
        expect(singularizeWordPtBr('coracoes')).toBe('coracao');
        expect(singularizeWordPtBr('classificacoes')).toBe('classificacao');
        expect(singularizeWordPtBr('informacoes')).toBe('informacao');
      });

      it('singularizes -ães → -ão', () => {
        expect(singularizeWordPtBr('paes')).toBe('pao');
        expect(singularizeWordPtBr('caes')).toBe('cao');
        expect(singularizeWordPtBr('capitaes')).toBe('capitao');
      });

      it('singularizes -ãos → -ão', () => {
        expect(singularizeWordPtBr('maos')).toBe('mao');
        expect(singularizeWordPtBr('cidadaos')).toBe('cidadao');
        expect(singularizeWordPtBr('irmaos')).toBe('irmao');
      });
    });

    describe('-ns → -m', () => {
      it('singularizes -ns → -m', () => {
        expect(singularizeWordPtBr('homens')).toBe('homem');
        expect(singularizeWordPtBr('viagens')).toBe('viagem');
        expect(singularizeWordPtBr('itens')).toBe('item');
        expect(singularizeWordPtBr('jardins')).toBe('jardim');
      });
    });

    describe('-l endings reverse', () => {
      it('singularizes -ais → -al', () => {
        expect(singularizeWordPtBr('animais')).toBe('animal');
        expect(singularizeWordPtBr('canais')).toBe('canal');
        expect(singularizeWordPtBr('hospitais')).toBe('hospital');
      });

      it('singularizes -eis → -el', () => {
        expect(singularizeWordPtBr('papeis')).toBe('papel');
        expect(singularizeWordPtBr('niveis')).toBe('nivel');
        expect(singularizeWordPtBr('aneis')).toBe('anel');
      });

      it('singularizes -ois → -ol', () => {
        expect(singularizeWordPtBr('anzois')).toBe('anzol');
        expect(singularizeWordPtBr('farois')).toBe('farol');
      });

      it('singularizes -uis → -ul', () => {
        expect(singularizeWordPtBr('azuis')).toBe('azul');
      });

      it('singularizes -is → -il', () => {
        expect(singularizeWordPtBr('barris')).toBe('barril');
        expect(singularizeWordPtBr('funis')).toBe('funil');
      });
    });

    describe('oxytone -Vses → -Vs', () => {
      it('singularizes -ases → -as', () => {
        expect(singularizeWordPtBr('gases')).toBe('gas');
      });

      it('singularizes -eses → -es', () => {
        expect(singularizeWordPtBr('meses')).toBe('mes');
        expect(singularizeWordPtBr('portugueses')).toBe('portugues');
      });

      it('singularizes -ises → -is', () => {
        expect(singularizeWordPtBr('paises')).toBe('pais');
      });

      it('singularizes -oses → -os', () => {
        expect(singularizeWordPtBr('poses')).toBe('pos');
      });

      it('singularizes -uses → -us', () => {
        expect(singularizeWordPtBr('buses')).toBe('bus');
      });
    });

    describe('consonant + es', () => {
      it('singularizes words ending in -res', () => {
        expect(singularizeWordPtBr('amores')).toBe('amor');
        expect(singularizeWordPtBr('flores')).toBe('flor');
        expect(singularizeWordPtBr('professores')).toBe('professor');
        expect(singularizeWordPtBr('fatores')).toBe('fator');
      });

      it('singularizes words ending in -zes', () => {
        expect(singularizeWordPtBr('luzes')).toBe('luz');
        expect(singularizeWordPtBr('pazes')).toBe('paz');
        expect(singularizeWordPtBr('vozes')).toBe('voz');
      });

      it('singularizes words ending in -nes', () => {
        expect(singularizeWordPtBr('abdomenes')).toBe('abdomen');
      });
    });

    describe('vowel + s', () => {
      it('singularizes regular plurals ending in -as/-os/-es', () => {
        expect(singularizeWordPtBr('casas')).toBe('casa');
        expect(singularizeWordPtBr('livros')).toBe('livro');
        expect(singularizeWordPtBr('usuarios')).toBe('usuario');
        expect(singularizeWordPtBr('acervos')).toBe('acervo');
        expect(singularizeWordPtBr('equipes')).toBe('equipe');
      });
    });

    describe('irregular singulars', () => {
      it('handles irregular singular mappings', () => {
        expect(singularizeWordPtBr('males')).toBe('mal');
        expect(singularizeWordPtBr('consules')).toBe('consul');
        expect(singularizeWordPtBr('quaisquer')).toBe('qualquer');
        expect(singularizeWordPtBr('caracteres')).toBe('carater');
        expect(singularizeWordPtBr('juniores')).toBe('junior');
        expect(singularizeWordPtBr('seniores')).toBe('senior');
      });
    });
  });

  describe('pluralizeRelationPropertyPtBr (compound terms)', () => {
    it('pluralizes simple terms', () => {
      expect(pluralizeRelationPropertyPtBr('usuario')).toBe('usuarios');
      expect(pluralizeRelationPropertyPtBr('acervo')).toBe('acervos');
      expect(pluralizeRelationPropertyPtBr('classificacao')).toBe('classificacoes');
    });

    it('pluralizes camelCase compound terms', () => {
      expect(pluralizeRelationPropertyPtBr('tipoAcervo')).toBe('tiposAcervos');
      expect(pluralizeRelationPropertyPtBr('processoAdministrativo')).toBe('processosAdministrativos');
    });

    it('pluralizes snake_case compound terms', () => {
      expect(pluralizeRelationPropertyPtBr('tipo_acervo')).toBe('tipos_acervos');
      expect(pluralizeRelationPropertyPtBr('processo_administrativo')).toBe('processos_administrativos');
    });

    it('handles compound terms with specifiers (only head varies)', () => {
      expect(pluralizeRelationPropertyPtBr('fatorCorrecao')).toBe('fatoresCorrecao');
      expect(pluralizeRelationPropertyPtBr('estadoSolicitacao')).toBe('estadosSolicitacao');
      expect(pluralizeRelationPropertyPtBr('projetoPadrao')).toBe('projetosPadrao');
    });

    it('handles compound terms with connectors (only head varies)', () => {
      expect(pluralizeRelationPropertyPtBr('certidaoDeNascimento')).toBe('certidoesDeNascimento');
    });
  });

  describe('singularizeRelationPropertyPtBr (compound terms)', () => {
    it('singularizes simple terms', () => {
      expect(singularizeRelationPropertyPtBr('usuarios')).toBe('usuario');
      expect(singularizeRelationPropertyPtBr('acervos')).toBe('acervo');
      expect(singularizeRelationPropertyPtBr('classificacoes')).toBe('classificacao');
    });

    it('singularizes camelCase compound terms', () => {
      expect(singularizeRelationPropertyPtBr('tiposAcervos')).toBe('tipoAcervo');
      expect(singularizeRelationPropertyPtBr('processosAdministrativos')).toBe('processoAdministrativo');
    });
  });

  describe('createPtBrInflector', () => {
    it('creates inflector with default irregulars', () => {
      const inflector = createPtBrInflector();
      expect(inflector.locale).toBe('pt-BR');
      expect(inflector.pluralizeWord('mao')).toBe('maos');
      expect(inflector.singularizeWord('maos')).toBe('mao');
    });

    it('allows custom irregulars to override defaults', () => {
      const inflector = createPtBrInflector({
        customIrregulars: { 'teste': 'testes_customizado' }
      });
      expect(inflector.pluralizeWord('teste')).toBe('testes_customizado');
      expect(inflector.pluralizeWord('mao')).toBe('maos'); // default still works
    });

    it('provides relation property methods', () => {
      const inflector = createPtBrInflector();
      expect(inflector.pluralizeRelationProperty('fatorCorrecao')).toBe('fatoresCorrecao');
      expect(inflector.singularizeRelationProperty('fatoresCorrecao')).toBe('fatorCorrecao');
    });
  });

  describe('PT_BR_DEFAULT_IRREGULARS consistency', () => {
    it('all irregular values are normalized (lowercase, no diacritics)', () => {
      for (const [key, value] of Object.entries(PT_BR_DEFAULT_IRREGULARS)) {
        expect(key).toBe(key.toLowerCase());
        expect(value).toBe(value.toLowerCase());
        expect(key).not.toMatch(/[áàâãéèêíìîóòôõúùûç]/i);
        expect(value).not.toMatch(/[áàâãéèêíìîóòôõúùûç]/i);
      }
    });
  });

  describe('round-trip consistency', () => {
    const testWords = [
      'casa', 'animal', 'papel', 'amor', 'luz', 'homem', 'aviao',
      'classificacao', 'usuario', 'acervo', 'gas', 'mes', 'pais',
      'barril', 'azul', 'anzol', 'flor', 'juiz'
    ];

    it('pluralize then singularize returns original', () => {
      for (const word of testWords) {
        const plural = pluralizeWordPtBr(word);
        const singular = singularizeWordPtBr(plural);
        expect(singular).toBe(word);
      }
    });
  });
});
