import * as THREE from 'three';
import vertexShader from '../glsl/vertexshader.vert';
import fragmentShader from '../glsl/fragmentshader.frag';
import throttle from 'lodash.throttle';
import { gsap } from 'gsap';

export default class WebGL {
    winSize: {
        [s: string]: number;
    };
    elms: {
        [s: string]: HTMLElement;
    };
    elmsAll: {
        [s: string]: NodeListOf<HTMLElement>;
    };
    dpr: number;
    three: {
        scene: THREE.Scene;
        renderer: THREE.WebGLRenderer | null;
        clock: THREE.Clock;
        redraw: any;
        camera: THREE.PerspectiveCamera | null;
        cameraFov: number;
        cameraAspect: number;
        earth: THREE.Mesh;
        planet: THREE.Mesh;
        jupiter: THREE.Mesh;
        saturn: THREE.Mesh;
        torus: THREE.Mesh;
        particleSystem: THREE.Points;
        geometry: THREE.BufferGeometry | null;
        particles: number;
    };
    mousePos: {
        x: number;
        y: number;
        targetX: number;
        targetY: number;
        moveX: number;
        moveY: number;
    };
    sp: boolean;
    ua: string;
    mq: MediaQueryList;
    srcTexture: {
        [s: string]: string;
    };
    flg: {
        [s: string]: boolean;
    };
    constructor() {
        this.winSize = {
            wd: window.innerWidth,
            wh: window.innerHeight,
            halfWd: window.innerWidth * 0.5,
            halfWh: window.innerHeight * 0.5,
        };
        this.elms = {
            canvas: document.querySelector('[data-canvas]'),
            mvTitle: document.querySelector('[data-mv="title"]'),
            mvHomeLink: document.querySelector('[data-mv="homeLink"]'),
            mvGitLink: document.querySelector('[data-mv="gitLink"]'),
            mvNoteLink: document.querySelector('[data-mv="noteLink"]'),
        };
        this.elmsAll = {
            mvText: document.querySelectorAll('.mv__text'),
        };
        // デバイスピクセル比(最大値=2)
        this.dpr = Math.min(window.devicePixelRatio, 2);
        this.three = {
            scene: null,
            renderer: null,
            clock: null,
            redraw: null,
            camera: null,
            cameraFov: 55,
            cameraAspect: window.innerWidth / window.innerHeight,
            earth: null,
            planet: null,
            jupiter: null,
            saturn: null,
            torus: null,
            particleSystem: null,
            geometry: null,
            particles: null,
        };
        this.mousePos = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            moveX: 0.05,
            moveY: 0.02,
        };
        this.sp = null;
        this.ua = window.navigator.userAgent.toLowerCase();
        this.mq = window.matchMedia('(max-width: 768px)');
        this.srcTexture = {
            earth: './img/earth.jpeg',
            planet: './img/planet.jpeg',
            jupiter: './img/jupiter.jpeg',
            saturn: './img/saturn.jpeg',
            ring: './img/ring.jpeg',
            spark: './img/spark1.png',
        };
        this.flg = {
            loaded: false,
        };
        this.init();
    }
    init(): void {
        this.getLayout();
        this.initScene();
        this.initCamera();
        this.initClock();
        this.setLight();
        this.initRenderer();
        this.setLoading();
        this.handleEvents();

        if (this.ua.indexOf('msie') !== -1 || this.ua.indexOf('trident') !== -1) {
            return;
        } else {
            this.mq.addEventListener('change', this.getLayout.bind(this));
        }
    }
    getLayout(): void {
        this.sp = this.mq.matches ? true : false;
    }
    initScene(): void {
        // シーンを作成
        this.three.scene = new THREE.Scene();
    }
    initCamera(): void {
        // カメラを作成(視野角, スペクト比, near, far)
        this.three.camera = new THREE.PerspectiveCamera(this.three.cameraFov, this.winSize.wd / this.winSize.wh, this.three.cameraAspect, 1000);
        this.three.camera.position.set(this.sp ? 0 : 80, 0, this.sp ? 600 : 300);
        this.three.camera.lookAt(new THREE.Vector3(0, 0, 0));
    }
    initClock(): void {
        // 時間計測用
        this.three.clock = new THREE.Clock();
    }
    initRenderer(): void {
        // レンダラーを作成
        this.three.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true, //背景色を設定しないとき、背景を透明にする
        });
        this.three.renderer.setPixelRatio(this.dpr); // retina対応
        this.three.renderer.setSize(this.winSize.wd, this.winSize.wh); // 画面サイズをセット
        this.three.renderer.physicallyCorrectLights = true;
        this.three.renderer.shadowMap.enabled = true; // シャドウを有効にする
        this.three.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // PCFShadowMapの結果から更に隣り合う影との間を線形補間して描画する
        this.three.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.elms.canvas.appendChild(this.three.renderer.domElement); // HTMLにcanvasを追加
        this.three.renderer.outputEncoding = THREE.GammaEncoding; // 出力エンコーディングを定義
    }
    setLight() {
        // 平行光源を作成(色, 光の強さ)
        const directionalLight = new THREE.DirectionalLight(0xb48246, 20);
        directionalLight.position.set(0, 5, 4);
        this.three.scene.add(directionalLight);
    }
    setParticle(): void {
        let uniforms;
        const radius = 200;
        const positions = [];
        const colors = [];
        const sizes = [];
        this.three.particles = 2000;

        uniforms = {
            pointTexture: { value: new THREE.TextureLoader().load(this.srcTexture.spark) },
        };

        const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true,
        });

        this.three.geometry = new THREE.BufferGeometry();
        const color = new THREE.Color();

        for (let i = 0; i < this.three.particles; i++) {
            positions.push((Math.random() * 2 - 1) * radius);
            positions.push((Math.random() * 2 - 1) * radius);
            positions.push((Math.random() * 2 - 1) * radius);

            color.setHSL(i / this.three.particles, 1.0, 0.5);
            colors.push(color.r, color.g, color.b);
            sizes.push(20);
        }

        this.three.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.three.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.three.geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));

        this.three.particleSystem = new THREE.Points(this.three.geometry, shaderMaterial);
        this.three.scene.add(this.three.particleSystem);
    }
    setLoading() {
        this.setParticle();
        // テクスチャー
        const loader = new THREE.TextureLoader();
        loader.load(this.srcTexture.earth, (texture) => {
            // 地球を作成
            this.three.earth = new THREE.Mesh(
                new THREE.SphereGeometry(80, 20, 20), // 形状
                new THREE.MeshLambertMaterial({
                    // マテリアル
                    map: texture,
                    opacity: 0.5,
                    transparent: true,
                })
            );
            this.three.earth.position.set(0, 0, 0);

            this.three.scene.add(this.three.earth);
            this.flg.loaded = true;
            this.rendering(); // レンダリングを開始する
        });

        //惑星を作成
        loader.load(this.srcTexture.planet, (texture) => {
            // 球体を作成
            this.three.planet = new THREE.Mesh(
                new THREE.SphereGeometry(10, 10, 10), // 形状
                new THREE.MeshLambertMaterial({
                    // マテリアル
                    map: texture,
                    opacity: 0.9,
                    transparent: true,
                })
            );
            this.three.planet.position.set(this.sp ? 100 : 200, -80, 0);
            this.three.scene.add(this.three.planet);
        });

        //木星を作成
        loader.load(this.srcTexture.jupiter, (texture) => {
            // 球体を作成
            this.three.jupiter = new THREE.Mesh(
                new THREE.SphereGeometry(26, 26, 26), // 形状
                new THREE.MeshLambertMaterial({
                    // マテリアル
                    map: texture,
                    opacity: 0.8,
                    transparent: true,
                })
            );
            this.three.jupiter.position.set(this.sp ? -100 : -200, -120, 0);
            this.three.scene.add(this.three.jupiter);
        });

        //土星の輪っかを生成
        loader.load(this.srcTexture.ring, (texture) => {
            // 球体を作成
            this.three.torus = new THREE.Mesh(
                new THREE.TorusGeometry(30, 5, 2, 1000), // 芯円半径、断面円半径、断面円分割、芯円分割30, 　5, 2, 1000, -100, 0, 0
                new THREE.MeshPhongMaterial({
                    // マテリアル
                    map: texture,
                    opacity: 1,
                    transparent: true,
                })
            );
            this.three.torus.position.set(-100, 100, 0);
            this.three.torus.rotation.set(2, 0, 0);
            this.three.scene.add(this.three.torus);
        });
        //土星を作成
        loader.load(this.srcTexture.saturn, (texture) => {
            // 球体を作成
            this.three.saturn = new THREE.Mesh(
                new THREE.SphereGeometry(15, 15, 15), // 形状
                new THREE.MeshLambertMaterial({
                    // マテリアル
                    map: texture,
                    opacity: 0.8,
                    transparent: true,
                })
            );
            this.three.saturn.position.set(-100, 100, 0);
            this.three.scene.add(this.three.saturn);
        });
    }
    rendering(): void {
        const time = Date.now() * 0.005;
        this.three.particleSystem.rotation.z = 0.001 * time;
        const sizes = this.three.geometry.attributes.size.array;

        for (let i = 0; i < this.three.particles; i++) {
            sizes[i] = 10 * (1 + Math.sin(0.1 * i + time));
        }
        this.three.geometry.attributes.size.needsUpdate = true;

        // マウスの位置を取得
        this.mousePos.x += (this.mousePos.targetX - this.mousePos.x) * this.mousePos.moveX;
        this.mousePos.y += (this.mousePos.targetY - this.mousePos.y) * this.mousePos.moveY;
        // 3dモデルの位置と回転を調整
        this.three.earth.rotation.y = 0 - this.mousePos.x * 0.5; //マウスの位置によって3dの位置をずらす
        this.three.camera.rotation.y = this.mousePos.x * 0.09; //マウスの位置によってカメラ位置をずらす
        this.three.camera.rotation.x = this.mousePos.y * 0.04; //マウスの位置によってカメラ位置をずらす

        // レンダリングを実行
        requestAnimationFrame(this.rendering.bind(this));
        this.three.renderer.render(this.three.scene, this.three.camera);
        this.animate(); // アニメーション開始
    }
    animate() {
        gsap.config({
            force3D: true,
        });
        const tl = gsap.timeline({
            paused: true,
            defaults: {
                duration: 0.6,
                ease: 'power2.inOut',
            },
        });
        tl.to(
            this.three.earth.rotation,
            {
                duration: 2.5,
                ease: 'power4.easeOut',
                z: 0.5,
            },
            0.3
        );
        tl.to(
            this.three.jupiter.rotation,
            {
                duration: 2.5,
                ease: 'power4.easeOut',
                y: 0.5,
            },
            0.3
        );
        tl.to(
            this.three.saturn.rotation,
            {
                duration: 2.5,
                ease: 'power4.easeOut',
                y: 1,
                z: 1.1,
            },
            0.3
        );
        tl.to(
            this.three.planet.rotation,
            {
                duration: 2.5,
                ease: 'power4.easeOut',
                y: 1,
                z: 3.1,
            },
            0.3
        );
        tl.to(
            this.elms.canvas,
            {
                duration: 1,
                ease: 'power1.out',
                opacity: 1,
            },
            0.35
        );
        tl.to(
            this.elms.mvTitle,
            {
                duration: 0.5,
                ease: 'power2.easeOut',
                y: 0,
            },
            1
        );
        tl.to(
            this.elmsAll.mvText,
            {
                className: '+=mv__text is-active',
            },
            1
        );
        tl.to(
            this.elms.mvHomeLink,
            {
                duration: 0.5,
                ease: 'power2.easeOut',
                y: 0,
            },
            1.8
        );
        tl.to(
            this.elms.mvGitLink,
            {
                duration: 0.5,
                ease: 'power2.easeOut',
                y: 0,
            },
            1.8
        );
        tl.to(
            this.elms.mvNoteLink,
            {
                duration: 0.5,
                ease: 'power2.easeOut',
                y: 0,
            },
            1.8
        );
        tl.play();
    }
    handleEvents(): void {
        window.addEventListener('pointermove', this.handleMouse.bind(this), false);

        // リサイズイベント登録
        window.addEventListener(
            'resize',
            throttle(() => {
                this.handleResize();
            }, 100),
            false
        );
    }
    handleMouse(event: any) {
        this.mousePos.targetX = (this.winSize.halfWd - event.clientX) / this.winSize.halfWd;
        this.mousePos.targetY = (this.winSize.halfWh - event.clientY) / this.winSize.halfWh;
    }
    handleResize(): void {
        // リサイズ処理
        this.winSize = {
            wd: window.innerWidth,
            wh: window.innerHeight,
            halfWd: window.innerWidth * 0.5,
            halfWh: window.innerHeight * 0.5,
        };
        this.dpr = Math.min(window.devicePixelRatio, 2);
        if (this.three.camera) {
            // カメラの位置更新
            this.three.camera.aspect = this.winSize.wd / this.winSize.wh;
            this.three.camera.updateProjectionMatrix();
        }
        if (this.three.renderer) {
            // レンダラーの大きさ更新
            this.three.renderer.setSize(this.winSize.wd, this.winSize.wh);
            this.three.renderer.setPixelRatio(this.dpr);
        }
    }
}
