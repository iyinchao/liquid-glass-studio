import { useControls, folder, Leva } from 'leva';
import { isChineseLanguage, isUzbekLanguage } from './utils';
import { LevaVectorNew } from './components/LevaVectorNew/LevaVectorNew';
// import { LevaImageUpload } from './components/LevaImageUpload/LevaImageUpload';
import { LevaContainer } from './components/LevaContainer/LevaContainer';
import { LevaCheckButtons } from './components/LevaCheckButtons';
import { useLayoutEffect, useMemo, useState } from 'react';
import languages from './utils/languages';

export const useLevaControls = ({
  containerRender,
}: {
  containerRender: {
    bgType: (props: { value: number; setValue: (v: number) => void }) => React.ReactNode;
  };
}) => {
  const [langName, setLangName] = useState<keyof typeof languages>(
    isChineseLanguage() ? 'zh-CN' : isUzbekLanguage() ? 'uz-UZ' : 'en-US',
  );
  const lang = useMemo(() => {
    return languages[langName];
  }, [langName]);

  const [controls, controlsAPI] = useControls(
    () => ({
      ['basicSettings']: folder({
        language: LevaCheckButtons({
          label: lang['editor.language'],
          selected: [langName],
          options: !isChineseLanguage()
            ? [
              { value: 'en-US', label: 'English' },
              { value: 'zh-CN', label: '简体中文' },
              { value: 'uz-UZ', label: "O'zbekcha" },
            ]
            : [
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en-US', label: 'English' },
              { value: 'uz-UZ', label: "O'zbekcha" },
            ],
          onClick: (v) => {
            setLangName((v as (keyof typeof languages)[])[0]);
          },
          singleMode: true,
        }),
        editorMode: {
          label: lang['editor.editorMode'],
          value: false,
        },
      }),
      refThickness: {
        label: lang['editor.refThickness'],
        min: 1,
        max: 80,
        step: 0.01,
        value: 20,
      },
      refFactor: {
        label: lang['editor.refFactor'],
        min: 1,
        max: 4,
        step: 0.01,
        value: 1.4,
      },
      refDispersion: {
        label: lang['editor.refDispersion'],
        min: 0,
        max: 50,
        step: 0.01,
        value: 7,
      },
      refFresnelRange: {
        label: lang['editor.refFresnelRange'],
        min: 0,
        max: 100,
        step: 0.01,
        value: 30,
      },
      refFresnelHardness: {
        label: lang['editor.refFresnelHardness'],
        min: 0,
        max: 100,
        step: 0.01,
        value: 20,
      },
      refFresnelFactor: {
        label: lang['editor.refFresnelFactor'],
        min: 0,
        max: 100,
        step: 0.01,
        value: 20,
      },
      glareRange: {
        label: lang['editor.glareRange'],
        min: 0,
        max: 100,
        step: 0.01,
        value: 30,
      },
      glareHardness: {
        label: lang['editor.glareHardness'],
        min: 0,
        max: 100,
        step: 0.01,
        value: 20,
      },
      glareFactor: {
        label: lang['editor.glareFactor'],
        min: 0,
        max: 120,
        step: 0.01,
        value: 90,
      },
      glareConvergence: {
        label: lang['editor.glareConvergence'],
        min: 0,
        max: 100,
        step: 0.01,
        value: 50,
      },
      glareOppositeFactor: {
        label: lang['editor.glareOppositeFactor'],
        min: 0,
        max: 100,
        step: 0.01,
        value: 80,
      },
      glareAngle: {
        label: lang['editor.glareAngle'],
        min: -180,
        max: 180,
        step: 0.01,
        value: -45,
      },
      blurRadius: {
        label: lang['editor.blurRadius'],
        min: 1,
        max: 200,
        step: 1,
        value: 1,
      },
      blurEdge: {
        label: lang['editor.blurEdge'],
        value: true,
      },
      tint: {
        label: lang['editor.tint'],
        value: { r: 255, b: 255, g: 255, a: 0 },
      },
      shadowExpand: {
        label: lang['editor.shadowExpand'],
        min: 2,
        max: 100,
        step: 0.01,
        value: 25,
      },
      shadowFactor: {
        label: lang['editor.shadowFactor'],
        min: 0,
        max: 100,
        step: 0.01,
        value: 15,
      },
      shadowPosition: LevaVectorNew({
        label: lang['editor.shadowPosition'],
        x: 0,
        y: -10,
        xMax: 20,
        yMax: 20,
      }),
      bgType: LevaContainer({
        label: lang['editor.bgType'],
        contentValue: 0,
        content: containerRender.bgType,
      }),
      // customBgImage: LevaImageUpload({
      //   label: lang['editor.customBgImage'],
      //   file: undefined,
      //   // disabled: renderProps.isRendering,
      //   // alphaPatternColorA: '#bbb',
      //   // alphaPatternColorB: '#eee',
      // }),
      ['selfIllumination']: folder({
        emissiveColor: {
          label: lang['editor.emissiveColor'],
          value: { r: 255, g: 220, b: 200, a: 1 },
        },
        emissiveIntensity: {
          label: lang['editor.emissiveIntensity'],
          min: 0,
          max: 100,
          step: 0.01,
          value: 0,
        },
        emissivePulse: {
          label: lang['editor.emissivePulse'],
          value: false,
        },
      }, {
        collapsed: true,
      }),
      ['hdrSettings']: folder({
        hdrEnabled: {
          label: lang['editor.hdrEnabled'],
          value: false,
        },
        hdrExposure: {
          label: lang['editor.hdrExposure'],
          min: 0.1,
          max: 10.0,
          step: 0.01,
          value: 1.0,
        },
        hdrToneMappingType: {
          label: lang['editor.hdrToneMappingType'],
          value: 2,
          options: {
            'None': 0,
            'Reinhard': 1,
            'ACES': 2,
          },
        },
        hdrBloom: {
          label: lang['editor.hdrBloom'],
          min: 0,
          max: 1.0,
          step: 0.01,
          value: 0,
        },
      }, {
        collapsed: true,
      }),
      ['shapeSettings']: folder({
        shapeWidth: {
          label: lang['editor.shapeWidth'],
          min: 20,
          max: 800,
          step: 1,
          value: 200,
        },
        shapeHeight: {
          label: lang['editor.shapeHeight'],
          min: 20,
          max: 800,
          step: 1,
          value: 200,
        },
        shapeRadius: {
          label: lang['editor.shapeRadius'],
          min: 1,
          max: 100,
          step: 0.1,
          value: 80,
        },
        shapeRoundness: {
          label: lang['editor.shapeRoundness'],
          min: 2,
          max: 7,
          step: 0.01,
          value: 5,
        },
        mergeRate: {
          label: lang['editor.mergeRate'],
          min: 0,
          max: 0.3,
          step: 0.01,
          value: 0.05,
        },
        showShape1: {
          label: lang['editor.showShape1'],
          value: true,
        },
      }),
      ['textSettings']: folder({
        textEnabled: {
          label: lang['editor.textEnabled'],
          value: false,
        },
        textContent: {
          label: lang['editor.textContent'],
          value: 'Glass',
        },
        textSize: {
          label: lang['editor.textSize'],
          min: 20,
          max: 500,
          step: 1,
          value: 80,
        },
        textFont: {
          label: lang['editor.textFont'],
          value: 'Arial',
          options: {
            'Arial': 'Arial',
            'Helvetica': 'Helvetica',
            'Georgia': 'Georgia',
            'Times New Roman': 'Times New Roman',
            'Courier New': 'Courier New',
            'Verdana': 'Verdana',
            'Impact': 'Impact',
          },
        },
        textSuperSample: {
          label: lang['editor.textSuperSample'],
          min: 1,
          max: 4,
          step: 1,
          value: 2,
        },
      }, {
        collapsed: true,
      }),
      animationSettings: folder({
        springSizeFactor: {
          label: lang['editor.springSizeFactor'],
          min: 0,
          max: 50,
          step: 0.01,
          value: 10,
        },
      }, {
        collapsed: true
      }),
      uiContentSettings: folder({
        uiContentEnabled: {
          label: lang['editor.uiContentEnabled'],
          value: false,
        },
        uiContentType: {
          label: lang['editor.uiContentType'],
          value: 'clock' as string,
          options: {
            [lang['editor.uiContentType.clock']]: 'clock',
            [lang['editor.uiContentType.weather']]: 'weather',
            [lang['editor.uiContentType.music']]: 'music',
            [lang['editor.uiContentType.custom-text']]: 'custom-text',
          },
        },
        uiContentText: {
          label: lang['editor.uiContentText'],
          value: 'Hello World',
        },
        uiContentOpacity: {
          label: lang['editor.uiContentOpacity'],
          min: 0,
          max: 100,
          step: 1,
          value: 80,
        },
      }, {
        collapsed: true
      }),
      ['debugSettings']: folder({
        useWebGPU: {
          label: 'WebGPU',
          value: false,
        },
        step: {
          label: 'Show Step',
          value: 9,
          min: 0,
          max: 9,
          step: 1,
        },
      }, {
        collapsed: true
      }),
    }),
    [langName],
  );

  useLayoutEffect(() => {
    const levaRoot = document.querySelector('#root>[class^=leva]');
    if (!levaRoot) {
      return;
    }

    setTimeout(() => {
      const controlEls = (levaRoot.lastChild as HTMLDivElement).querySelectorAll('&>div>div');
      controlEls.forEach((el) => {
        const ctrlEl = el as HTMLDivElement;
        const styleStr = ctrlEl.getAttribute('style');
        if (styleStr && styleStr.includes('folder')) {
          // get title str:
          const titleEl = ctrlEl.querySelector('&>div>svg+div') as HTMLDivElement;
          if (!titleEl) {
            return;
          }
          const titleStr = titleEl.innerText;
          ctrlEl.style.setProperty(
            '--i18n-name',
            `"${lang[`editor.${titleStr}` as keyof Omit<typeof lang, '_settings'>] ?? titleStr}"`,
          );
          ctrlEl.dataset.levaFolder = '1';
        }
      });
    }, 0);
  }, [lang]);

  const levaGlobal = (
    <Leva
      theme={{
        sizes: {
          rootWidth: lang['_settings'].rootWidth,
          numberInputMinWidth: lang['_settings'].numberInputMinWidth,
          controlWidth: lang['_settings'].controlWidth,
        },
        space: {
          colGap: '5px',
        },
      }}
    ></Leva>
  );

  return {
    controls,
    controlsAPI,
    lang,
    langName,
    levaGlobal,
  };
};
